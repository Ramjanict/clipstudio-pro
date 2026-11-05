import { io, Socket } from 'socket.io-client';
import { store } from '@/store';
import {
  setConnectionStatus,
  setCurrentTask,
  updateTaskProgress,
  completeCurrentTask,
  setClusterStats,
  addWorkerLog,
} from '@/store/workerSlice';
import { WS_URL, getMediaUrl } from '@/lib/api';

class RenderWorkerService {
  private socket: Socket | null = null;
  private heartbeatInterval: any = null;
  private isProcessing = false;

  init() {
    if (this.socket) return;

    store.dispatch(setConnectionStatus('CONNECTING'));
    store.dispatch(addWorkerLog('Connecting to Distributed Render Network...'));

    const socketUrl = `${WS_URL}/rendering-ws`;
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      store.dispatch(setConnectionStatus('IDLE'));
      store.dispatch(addWorkerLog(`Connected as distributed worker node: ${this.socket?.id}`));

      const authUser = store.getState().auth.user;
      this.socket?.emit('worker:register', {
        userId: authUser?._id,
        userName: authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Browser Worker',
        cores: navigator.hardwareConcurrency || 4,
        memoryGb: (navigator as any).deviceMemory || 8,
      });

      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      store.dispatch(setConnectionStatus('DISCONNECTED'));
      store.dispatch(addWorkerLog('Disconnected from render network.'));
      this.stopHeartbeat();
    });

    this.socket.on('network:stats', (stats) => {
      store.dispatch(setClusterStats(stats));
    });

    this.socket.on('render:assign_segment', async (payload) => {
      const isEnabled = store.getState().worker.isWorkerEnabled;
      if (!isEnabled || this.isProcessing) {
        this.socket?.emit('worker:segment_error', {
          jobId: payload.jobId,
          segmentIndex: payload.segmentIndex,
          error: 'Worker busy or disabled by user',
        });
        return;
      }

      await this.processSegment(payload);
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const isBusy = store.getState().worker.connectionStatus === 'RENDERING';
        this.socket.emit('worker:heartbeat', { status: isBusy ? 'BUSY' : 'IDLE' });
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async processSegment(payload: {
    jobId: string;
    segmentIndex: number;
    startSec: number;
    endSec: number;
    duration: number;
    fps: number;
    resolution: { w: number; h: number };
    segmentSceneGraph: any;
    uploadEndpoint: string;
  }) {
    this.isProcessing = true;
    store.dispatch(setConnectionStatus('RENDERING'));
    store.dispatch(
      setCurrentTask({
        jobId: payload.jobId,
        segmentIndex: payload.segmentIndex,
        startSec: payload.startSec,
        endSec: payload.endSec,
        duration: payload.duration,
        percent: 0,
        status: 'rendering',
      }),
    );
    store.dispatch(
      addWorkerLog(`Assigned Segment #${payload.segmentIndex} (${payload.startSec}s - ${payload.endSec}s)`),
    );

    const canvas = document.createElement('canvas');
    const width = payload.resolution?.w || 1280;
    const height = payload.resolution?.h || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      this.socket?.emit('worker:segment_error', {
        jobId: payload.jobId,
        segmentIndex: payload.segmentIndex,
        error: 'Unable to initialize canvas 2D context',
      });
      this.isProcessing = false;
      return;
    }

    try {
      // Capture canvas stream
      const fps = payload.fps || 30;
      const stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4000000,
      });

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      recorder.start(100);

      // Preload video elements for this segment
      const videoElements: Map<string, HTMLVideoElement> = new Map();
      const loadPromises: Promise<void>[] = [];

      for (const track of payload.segmentSceneGraph.tracks || []) {
        for (const clip of track.clips || []) {
          if (clip.asset?.type === 'video' || clip.asset?.type === 'audio') {
            const v = document.createElement('video');
            v.crossOrigin = 'anonymous';
            v.preload = 'auto';
            v.src = getMediaUrl(clip.asset.original_url || clip.asset.preview_url);
            loadPromises.push(
              new Promise((res) => {
                v.onloadedmetadata = () => res();
                v.onerror = () => res();
                setTimeout(res, 3000);
              })
            );
            v.load();
            videoElements.set(clip.assetId, v);
          }
        }
      }

      await Promise.all(loadPromises);

      const totalFrames = Math.ceil(payload.duration * fps);
      const frameIntervalSec = 1 / fps;

      for (let frame = 0; frame < totalFrames; frame++) {
        const currentTime = frame * frameIntervalSec;

        // Clear background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Find active clips for this frame
        const activeClips: any[] = [];
        for (const track of payload.segmentSceneGraph.tracks || []) {
          for (const clip of track.clips || []) {
            if (currentTime >= clip.startTime && currentTime <= clip.endTime) {
              activeClips.push(clip);
            }
          }
        }

        // Draw clips (bottom to top)
        for (const clip of [...activeClips].reverse()) {
          if (clip.asset?.type === 'video') {
            const vid = videoElements.get(clip.assetId);
            if (vid) {
              const targetTime = clip.trimIn + (currentTime - clip.startTime);
              if (Math.abs(vid.currentTime - targetTime) > 0.05) {
                vid.currentTime = targetTime;
              }
              if (vid.readyState >= 2) {
                const scale = Math.min(width / vid.videoWidth, height / vid.videoHeight);
                const dw = vid.videoWidth * scale;
                const dh = vid.videoHeight * scale;
                ctx.drawImage(vid, (width - dw) / 2, (height - dh) / 2, dw, dh);
              }
            }
          } else if (clip.asset?.type === 'text') {
            ctx.save();
            ctx.font = `bold ${Math.round(height * 0.07)}px Inter, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(clip.asset.content || '', width / 2, height / 2);
            ctx.restore();
          }
        }

        // Emit progress
        const percent = Math.round((frame / totalFrames) * 90);
        if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
          store.dispatch(updateTaskProgress({ percent, status: 'rendering' }));
          this.socket?.emit('worker:segment_progress', {
            jobId: payload.jobId,
            segmentIndex: payload.segmentIndex,
            percent,
          });
        }

        // Allow browser frame tick
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, Math.floor(1000 / fps / 2))));
      }

      // Finish recording
      store.dispatch(updateTaskProgress({ percent: 92, status: 'encoding' }));
      recorder.stop();

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      const videoBlob = new Blob(recordedChunks, { type: mimeType });

      // Upload chunk to server
      store.dispatch(updateTaskProgress({ percent: 96, status: 'uploading' }));
      store.dispatch(addWorkerLog(`Uploading finished chunk for Segment #${payload.segmentIndex} (${(videoBlob.size / 1024).toFixed(1)} KB)`));

      const formData = new FormData();
      formData.append('chunk', videoBlob, `segment_${payload.segmentIndex}.webm`);
      formData.append('jobId', payload.jobId);
      formData.append('segmentIndex', String(payload.segmentIndex));

      const uploadRes = await fetch(payload.uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`Chunk upload failed with status ${uploadRes.status}`);
      }

      const uploadJson = await uploadRes.json();

      // Notify completion
      this.socket?.emit('worker:segment_complete', {
        jobId: payload.jobId,
        segmentIndex: payload.segmentIndex,
        chunkFileName: uploadJson.filename,
      });

      store.dispatch(completeCurrentTask());
      store.dispatch(addWorkerLog(`✓ Segment #${payload.segmentIndex} successfully rendered & delivered!`));
    } catch (err: any) {
      store.dispatch(addWorkerLog(`❌ Error in Segment #${payload.segmentIndex}: ${err.message}`));
      this.socket?.emit('worker:segment_error', {
        jobId: payload.jobId,
        segmentIndex: payload.segmentIndex,
        error: err.message,
      });
      store.dispatch(setConnectionStatus('IDLE'));
      store.dispatch(setCurrentTask(null));
    } finally {
      this.isProcessing = false;
    }
  }

  destroy() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const renderWorker = new RenderWorkerService();
export default renderWorker;
