/**
 * WASM-based Video Encoder using ffmpeg.wasm
 * Fallback encoder for browsers without WebCodecs (Firefox, Safari).
 *
 * IMPORTANT: ffmpeg.wasm requires the page to be served with:
 * - Cross-Origin-Opener-Policy: same-origin
 * - Cross-Origin-Embedder-Policy: require-corp
 * These headers enable SharedArrayBuffer which ffmpeg.wasm needs.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface WasmEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  onProgress?: (percent: number) => void;
  onLog?: (msg: string) => void;
}

export class WasmEncoder {
  private ffmpeg: FFmpeg | null = null;
  private frameIndex = 0;
  private totalFrames = 0;
  private options: Required<WasmEncoderOptions>;
  private loaded = false;

  constructor(opts: WasmEncoderOptions) {
    this.options = {
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      bitrate: opts.bitrate || 4_000_000,
      onProgress: opts.onProgress || (() => {}),
      onLog: opts.onLog || (() => {}),
    };
  }

  async init(totalFrames: number): Promise<void> {
    this.totalFrames = totalFrames;
    this.frameIndex = 0;

    // Check SharedArrayBuffer support
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error(
        'SharedArrayBuffer is not available. Your server must set ' +
        'Cross-Origin-Opener-Policy: same-origin and ' +
        'Cross-Origin-Embedder-Policy: require-corp headers.'
      );
    }

    this.ffmpeg = new FFmpeg();

    this.ffmpeg.on('log', ({ message }) => {
      this.options.onLog(message);
    });

    this.ffmpeg.on('progress', ({ progress }) => {
      // ffmpeg.wasm reports progress 0-1 during encoding
      const percent = Math.round(90 + progress * 5); // 90-95% range
      this.options.onProgress(percent);
    });

    this.options.onLog('Loading ffmpeg.wasm core...');
    await this.ffmpeg.load();
    this.loaded = true;
    this.options.onLog('ffmpeg.wasm core loaded successfully.');
  }

  async addFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.ffmpeg || !this.loaded) return;

    // Convert canvas to JPEG blob and write to virtual FS
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
    });

    const frameFileName = `frame_${String(this.frameIndex).padStart(6, '0')}.jpg`;
    const data = await fetchFile(blob);
    await this.ffmpeg.writeFile(frameFileName, data);

    this.frameIndex++;

    // Report progress (0-90% for frame capture phase)
    const percent = Math.round((this.frameIndex / this.totalFrames) * 90);
    this.options.onProgress(percent);
  }

  async finalize(): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('WASM encoder not initialized');
    }

    this.options.onLog(`Encoding ${this.frameIndex} frames to MP4...`);
    this.options.onProgress(90);

    const bitrateK = Math.round(this.options.bitrate / 1000);

    // Run ffmpeg encoding: frames → MP4
    await this.ffmpeg.exec([
      '-framerate', String(this.options.fps),
      '-i', 'frame_%06d.jpg',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-b:v', `${bitrateK}k`,
      '-preset', 'ultrafast',
      '-movflags', '+faststart',
      'output.mp4',
    ]);

    this.options.onProgress(95);

    // Read output file
    const outputData = await this.ffmpeg.readFile('output.mp4');
    const outputBlob = new Blob([outputData instanceof Uint8Array ? new Uint8Array(outputData) : outputData], { type: 'video/mp4' });

    this.options.onLog(`Encoding complete. Output size: ${(outputBlob.size / 1024 / 1024).toFixed(1)} MB`);

    // Cleanup virtual FS
    for (let i = 0; i < this.frameIndex; i++) {
      const fn = `frame_${String(i).padStart(6, '0')}.jpg`;
      try { await this.ffmpeg.deleteFile(fn); } catch {}
    }
    try { await this.ffmpeg.deleteFile('output.mp4'); } catch {}

    return outputBlob;
  }

  destroy(): void {
    if (this.ffmpeg) {
      try { this.ffmpeg.terminate(); } catch {}
    }
    this.ffmpeg = null;
    this.loaded = false;
  }
}
