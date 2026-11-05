/**
 * Browser Export Engine
 * Unified rendering engine that orchestrates canvas-based frame rendering
 * and routes to the optimal encoder (WebCodecs → WASM → MediaRecorder → Server).
 *
 * Flow:
 * 1. Detect browser capabilities
 * 2. Initialize the appropriate encoder
 * 3. Render each frame on an offscreen canvas
 * 4. Feed frames to the encoder
 * 5. Finalize and upload the MP4 blob to the server
 */
import { detectCapabilities, estimateRenderTimeSec } from './browserCapabilities';
import { WebCodecEncoder } from './webcodecEncoder';
import { WasmEncoder } from './wasmEncoder';
import { getMediaUrl, API_BASE } from '@/lib/api';
import type { BrowserCapabilities } from './browserCapabilities';

export interface BrowserExportCallbacks {
  onProgress: (percent: number, status: string, etaSec: number | null) => void;
  onComplete: (uploadedUrl: string) => void;
  onError: (message: string) => void;
}

interface EncoderAdapter {
  init(totalFrames: number): Promise<void>;
  addFrame(canvas: HTMLCanvasElement): Promise<void>;
  finalize(): Promise<Blob>;
  destroy(): void;
}

/**
 * Check if we can render in the browser for targetMode ('browser' | 'server').
 */
export async function canRenderInBrowser(
  sceneGraph: any,
  targetMode: 'browser' | 'server' = 'server',
): Promise<{
  canRender: boolean;
  capabilities: BrowserCapabilities;
  estimatedSec: number;
  reason: string;
}> {
  const caps = await detectCapabilities();
  const estimatedSec = estimateRenderTimeSec(sceneGraph, caps);

  if (targetMode === 'server') {
    return {
      canRender: false,
      capabilities: caps,
      estimatedSec,
      reason: 'User selected Cloud Server Engine',
    };
  }

  if (caps.recommendedEncoder === 'server') {
    return {
      canRender: false,
      capabilities: caps,
      estimatedSec,
      reason: 'No in-browser encoder available in your browser',
    };
  }

  return {
    canRender: true,
    capabilities: caps,
    estimatedSec,
    reason: 'User selected Local Browser Engine',
  };
}

let activeExportId = 0;

/**
 * Cancels any currently running browser export loop immediately.
 */
export function cancelCurrentBrowserExport(): void {
  activeExportId++;
  console.log(`[BrowserExportEngine] Active browser export cancelled/invalidated (New ID: ${activeExportId}).`);
}

/**
 * Main browser export function.
 * Renders the sceneGraph frame-by-frame on canvas and encodes to MP4.
 */
export async function exportInBrowser(
  sceneGraph: any,
  callbacks: BrowserExportCallbacks,
): Promise<void> {
  const currentId = ++activeExportId;
  const caps = await detectCapabilities();
  const fps = sceneGraph.fps || 30;
  const duration = sceneGraph.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const rawWidth = sceneGraph.resolution?.w || 1280;
  const rawHeight = sceneGraph.resolution?.h || 720;
  const width = Math.floor(rawWidth / 2) * 2;
  const height = Math.floor(rawHeight / 2) * 2;

  let encoderName = '';
  let encoder: EncoderAdapter;

  // Select encoder based on capabilities
  // NOTE: Do NOT pass onProgress to encoder — the frame loop below handles all progress
  // reporting with accurate ETA. The encoder's internal onProgress caused ETA to flicker
  // null on every single frame (overwriting the frame loop's ETA value).
  if (caps.hasWebCodecs) {
    encoderName = 'WebCodecs H.264';
    encoder = new WebCodecEncoder({
      width,
      height,
      fps,
      bitrate: 4_000_000,
    });
  } else if (caps.hasWasm && caps.hasSharedArrayBuffer) {
    encoderName = 'ffmpeg.wasm (WASM)';
    encoder = new WasmEncoder({
      width,
      height,
      fps,
      bitrate: 4_000_000,
      onLog: (msg) => console.log('[WasmEncoder]', msg),
    });
  } else {
    // MediaRecorder fallback — produces WebM, not MP4
    encoderName = 'MediaRecorder (WebM)';
    encoder = createMediaRecorderAdapter(width, height, fps);
  }

  callbacks.onProgress(2, `Initializing ${encoderName} encoder...`, null);

  try {
    // 1. Initialize encoder with automatic in-browser fallback
    try {
      await encoder.init(totalFrames);
    } catch (initErr: any) {
      if (encoderName.includes('WebCodecs')) {
        console.warn('[BrowserExportEngine] WebCodecs GPU init failed, falling back to MediaRecorder in browser:', initErr);
        encoderName = 'MediaRecorder (WebM)';
        encoder = createMediaRecorderAdapter(width, height, fps);
        await encoder.init(totalFrames);
      } else {
        throw initErr;
      }
    }
    if (currentId !== activeExportId) return;

    // 2. Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 3. Preload media assets
    callbacks.onProgress(5, 'Loading media assets...', null);
    const { videoElements, imageElements } = await preloadAssets(sceneGraph);
    if (currentId !== activeExportId) return;

    // 4. Render frame-by-frame
    const startTime = performance.now();
    // Track which video is currently seeked to what time (avoid re-seeking same position)
    const videoCurrentTimes = new Map<string, number>();

    for (let frame = 0; frame < totalFrames; frame++) {
      if (currentId !== activeExportId) {
        console.log(`[BrowserExportEngine] Export #${currentId} cancelled during frame ${frame + 1}.`);
        return;
      }
      const currentTime = frame / fps;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Find active clips sorted by Painter's Algorithm layer priority
      const activeClips = getSortedActiveClips(sceneGraph, currentTime);

      // Synchronize video seeking with fast 30ms non-blocking fallback to keep GPU encoder active
      const videoClips = activeClips.filter((c: any) => c.asset?.type === 'video');
      const seekNeeded: Promise<void>[] = [];

      for (const clip of videoClips) {
        const vid = videoElements.get(clip.assetId) || videoElements.get(clip.id);
        if (vid && vid.readyState >= 2) {
          const targetTime = (clip.trimIn || 0) + (currentTime - clip.startTime);
          const lastTime = videoCurrentTimes.get(clip.id) ?? -999;
          const delta = Math.abs(targetTime - lastTime);

          // Only seek if time delta is greater than ~40ms
          if (delta > 0.04 && Math.abs(vid.currentTime - targetTime) > 0.04) {
            seekNeeded.push(
              new Promise<void>((resolve) => {
                let done = false;
                const finish = () => {
                  if (!done) {
                    done = true;
                    resolve();
                  }
                };
                const timeout = setTimeout(finish, 30);
                vid.addEventListener(
                  'seeked',
                  () => {
                    clearTimeout(timeout);
                    finish();
                  },
                  { once: true }
                );
                try {
                  vid.currentTime = targetTime;
                } catch {
                  finish();
                }
              })
            );
          }
          videoCurrentTimes.set(clip.id, targetTime);
        }
      }

      if (seekNeeded.length > 0) {
        await Promise.all(seekNeeded);
      }

      // Draw all clips in painter's order (video first, text last on top)
      for (const clip of activeClips) {
        drawClip(ctx, clip, currentTime, width, height, videoElements, imageElements);
      }

      // Feed frame to hardware encoder
      await encoder.addFrame(canvas);

      // Calculate rolling ETA & progress (update UI every 5 frames to keep React rendering silky-smooth)
      if (frame % 5 === 0 || frame === totalFrames - 1) {
        const elapsed = (performance.now() - startTime) / 1000;
        const rollingFps = (frame + 1) / elapsed;
        const remainingFrames = totalFrames - frame - 1;
        const etaSec = rollingFps > 0 ? Math.ceil(remainingFrames / rollingFps) : null;
        const renderPercent = Math.round(5 + (frame / totalFrames) * 80);

        callbacks.onProgress(renderPercent, `Rendering frame ${frame + 1}/${totalFrames} (${encoderName})`, etaSec);
      }

      // Yield to GPU pipeline every 20 frames (not every 10 — less overhead)
      // Use Promise.resolve() microtask instead of requestAnimationFrame (faster, no vsync lock)
      if (frame % 20 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    // 5. Finalize encoding
    callbacks.onProgress(88, 'Finalizing video encoding...', 3);
    const videoBlob = await encoder.finalize();

    // 6. Upload to server
    callbacks.onProgress(92, 'Uploading rendered video to server...', null);
    const uploadedUrl = await uploadToServer(videoBlob, encoderName.includes('WebM') ? 'webm' : 'mp4');

    callbacks.onProgress(100, 'Export complete!', 0);
    callbacks.onComplete(uploadedUrl);

    // Cleanup video elements
    videoElements.forEach((v) => {
      v.pause();
      v.src = '';
    });
  } catch (err: any) {
    console.error('[BrowserExportEngine] Export failed:', err);
    callbacks.onError(err.message || 'Browser export failed');
  } finally {
    encoder.destroy();
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function preloadAssets(sceneGraph: any): Promise<{
  videoElements: Map<string, HTMLVideoElement>;
  imageElements: Map<string, HTMLImageElement>;
}> {
  const videoElements = new Map<string, HTMLVideoElement>();
  const imageElements = new Map<string, HTMLImageElement>();
  const loadPromises: Promise<void>[] = [];

  for (const track of sceneGraph.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.asset?.type === 'video' || clip.asset?.type === 'audio') {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.preload = 'auto';
        v.muted = true;
        v.src = getMediaUrl(clip.asset.original_url || clip.asset.preview_url);

        loadPromises.push(
          new Promise<void>((resolve) => {
            v.onloadeddata = () => resolve();
            v.onerror = () => resolve();
            setTimeout(resolve, 5000);
          }),
        );

        v.load();
        videoElements.set(clip.assetId, v);
        if (clip.id) videoElements.set(clip.id, v);
      } else if (clip.asset?.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getMediaUrl(clip.asset.original_url || clip.asset.preview_url);

        loadPromises.push(
          new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 3000);
          }),
        );

        imageElements.set(clip.assetId, img);
        if (clip.id) imageElements.set(clip.id, img);
      }
    }
  }

  await Promise.all(loadPromises);
  return { videoElements, imageElements };
}

import { drawClipToCanvas, getSortedActiveClips } from './elementRenderer';

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: any,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  videoElements: Map<string, HTMLVideoElement>,
  imageElements: Map<string, HTMLImageElement>,
): void {
  drawClipToCanvas(ctx, clip, currentTime, canvasWidth, canvasHeight, {
    videoElements,
    imageElements,
  });
}

async function uploadToServer(blob: Blob, format: string): Promise<string> {
  const formData = new FormData();
  const fileName = `browser_export_${Date.now()}.${format}`;
  formData.append('file', blob, fileName);

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/export/browser-upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.url;
}

/**
 * MediaRecorder adapter — wraps the legacy MediaRecorder API
 * to conform to the EncoderAdapter interface.
 * Produces WebM output (not MP4).
 */
function createMediaRecorderAdapter(
  width: number,
  height: number,
  fps: number,
  onProgress?: (percent: number) => void,
): EncoderAdapter {
  let canvas: HTMLCanvasElement | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let frameCount = 0;
  let totalFrames = 0;

  return {
    async init(total: number) {
      totalFrames = total;
      frameCount = 0;
      chunks = [];

      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.start(100);
    },

    async addFrame(sourceCanvas: HTMLCanvasElement) {
      // Copy source canvas to the stream canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceCanvas, 0, 0);
        }
      }
      frameCount++;
      if (onProgress) {
        const percent = Math.round((frameCount / totalFrames) * 90);
        onProgress(percent);
      }
    },

    async finalize(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!recorder) {
          resolve(new Blob(chunks, { type: 'video/webm' }));
          return;
        }

        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder?.mimeType || 'video/webm' }));
        };

        recorder.stop();
      });
    },

    destroy() {
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      canvas = null;
      stream = null;
      recorder = null;
      chunks = [];
    },
  };
}
