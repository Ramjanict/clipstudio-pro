/**
 * WebCodecs H.264 Encoder + MP4 Muxer
 * Uses the browser's hardware-accelerated VideoEncoder API (Chrome/Edge)
 * and mp4-muxer to produce MP4 output from canvas frames.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface WebCodecEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  onProgress?: (percent: number) => void;
}

export class WebCodecEncoder {
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private encoder: VideoEncoder | null = null;
  private frameIndex = 0;
  private totalFrames = 0;
  private options: Required<WebCodecEncoderOptions>;
  private encodedFrameCount = 0;
  private lastError: Error | null = null;

  constructor(opts: WebCodecEncoderOptions) {
    // Force even numbers for width and height (required by hardware H.264 encoders)
    const width = Math.floor((opts.width || 1280) / 2) * 2;
    const height = Math.floor((opts.height || 720) / 2) * 2;

    this.options = {
      width: Math.max(16, width),
      height: Math.max(16, height),
      fps: opts.fps || 30,
      bitrate: opts.bitrate || 4_000_000,
      onProgress: opts.onProgress || (() => {}),
    };
  }

  async init(totalFrames: number): Promise<void> {
    this.totalFrames = totalFrames;
    this.frameIndex = 0;
    this.encodedFrameCount = 0;
    this.lastError = null;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: this.options.width,
        height: this.options.height,
      },
      fastStart: 'in-memory',
    });

    const muxer = this.muxer;

    // Detect best GPU-supported codec candidate
    const candidateCodecs = [
      'avc1.64002a', // High Profile Level 4.2
      'avc1.4d402a', // Main Profile Level 4.2
      'avc1.4d401f', // Main Profile Level 3.1
      'avc1.42e01f', // Constrained Baseline Level 3.1
      'avc1.42001f', // Baseline Level 3.1
    ];

    let selectedCodec = 'avc1.4d402a';

    if (typeof VideoEncoder !== 'undefined' && typeof (VideoEncoder as any).isConfigSupported === 'function') {
      for (const candidate of candidateCodecs) {
        try {
          const support = await (VideoEncoder as any).isConfigSupported({
            codec: candidate,
            width: this.options.width,
            height: this.options.height,
            bitrate: this.options.bitrate,
            framerate: this.options.fps,
          });
          if (support && support.supported) {
            selectedCodec = candidate;
            break;
          }
        } catch {}
      }
    }

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (muxer) {
          muxer.addVideoChunk(chunk, meta ?? undefined);
          this.encodedFrameCount++;
        }
      },
      error: (e) => {
        console.error('[WebCodecEncoder] Encoder hardware error:', e);
        this.lastError = e instanceof Error ? e : new Error(String((e as any)?.message || e));
      },
    });

    try {
      this.encoder.configure({
        codec: selectedCodec,
        width: this.options.width,
        height: this.options.height,
        bitrate: this.options.bitrate,
        framerate: this.options.fps,
        avc: { format: 'avc' },
      });
    } catch (err: any) {
      this.lastError = err instanceof Error ? err : new Error(String(err));
      throw this.lastError;
    }
  }

  async addFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (this.lastError) {
      throw this.lastError;
    }

    if (!this.encoder || (this.encoder.state as string) === 'closed') {
      if (this.lastError) throw this.lastError;
      throw new Error('VideoEncoder was closed unexpectedly during frame encoding.');
    }

    const timestamp = Math.round((this.frameIndex / this.options.fps) * 1_000_000); // microseconds
    const duration = Math.round((1 / this.options.fps) * 1_000_000);

    const frame = new VideoFrame(canvas, {
      timestamp,
      duration,
    });

    // Keyframe every 5 seconds (150 frames at 30fps) — fewer I-frames = faster encoding
    const isKeyFrame = this.frameIndex % (this.options.fps * 5) === 0;

    try {
      this.encoder.encode(frame, { keyFrame: isKeyFrame });
    } catch (err: any) {
      frame.close();
      this.lastError = err instanceof Error ? err : new Error(String(err));
      throw this.lastError;
    } finally {
      frame.close();
    }

    this.frameIndex++;

    const percent = Math.round((this.frameIndex / this.totalFrames) * 90);
    this.options.onProgress(percent);

    // Backpressure: if encoder queue is full, yield until drained
    // Use setTimeout (4ms) instead of requestAnimationFrame to prevent 2s GPU idle reclaim when tab/modal is backgrounded or throttled
    if (this.encoder && this.encoder.encodeQueueSize > 6) {
      await new Promise<void>((resolve, reject) => {
        const drain = () => {
          if (this.lastError) return reject(this.lastError);
          if (!this.encoder || (this.encoder.state as string) === 'closed') {
            return reject(new Error('VideoEncoder closed during queue drain.'));
          }
          if (this.encoder.encodeQueueSize <= 2) {
            resolve();
          } else {
            setTimeout(drain, 4);
          }
        };
        setTimeout(drain, 4);
      });
    }
  }

  async finalize(): Promise<Blob> {
    if (this.lastError) {
      throw this.lastError;
    }

    if (!this.encoder || !this.muxer) {
      throw new Error('Encoder not initialized');
    }

    if ((this.encoder.state as string) === 'closed') {
      if (this.lastError) throw this.lastError;
      throw new Error('VideoEncoder is closed and cannot flush remaining frames.');
    }

    // Flush remaining frames safely
    await this.encoder.flush();

    if ((this.encoder.state as string) !== 'closed') {
      this.encoder.close();
    }

    // Finalize MP4
    this.muxer.finalize();

    const { buffer } = this.muxer.target;
    this.options.onProgress(95);

    return new Blob([buffer], { type: 'video/mp4' });
  }

  destroy(): void {
    if (this.encoder && (this.encoder.state as string) !== 'closed') {
      try {
        this.encoder.close();
      } catch {}
    }
    this.encoder = null;
    this.muxer = null;
    this.lastError = null;
  }
}
