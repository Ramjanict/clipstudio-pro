/**
 * Browser Capability Detection for Video Export
 * Detects WebCodecs, WASM, and MediaRecorder support to route
 * export rendering to the optimal encoder pipeline.
 */

export interface BrowserCapabilities {
  hasWebCodecs: boolean;
  hasWasm: boolean;
  hasMediaRecorder: boolean;
  hasSharedArrayBuffer: boolean;
  cores: number;
  memoryGb: number;
  browserName: 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';
  recommendedEncoder: 'webcodecs' | 'wasm' | 'mediarecorder' | 'server';
}

let cachedCapabilities: BrowserCapabilities | null = null;

function detectBrowser(): BrowserCapabilities['browserName'] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  return 'other';
}

async function checkWebCodecsH264(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const config = {
      codec: 'avc1.42001f', // H.264 Baseline Level 3.1
      width: 1280,
      height: 720,
      bitrate: 4_000_000,
      framerate: 30,
    };
    const support = await VideoEncoder.isConfigSupported(config);
    return support.supported === true;
  } catch {
    return false;
  }
}

function checkWasmSupport(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
}

function checkSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

function checkMediaRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function detectCapabilities(): Promise<BrowserCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const hasWebCodecs = await checkWebCodecsH264();
  const hasWasm = checkWasmSupport();
  const hasSharedArrayBuffer = checkSharedArrayBuffer();
  const hasMediaRecorder = checkMediaRecorder();
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGb = (navigator as any).deviceMemory || 4;
  const browserName = detectBrowser();

  // Determine recommended encoder:
  // 1. WebCodecs (Chrome/Edge) — hardware-accelerated H.264
  // 2. WASM (ffmpeg.wasm) — requires SharedArrayBuffer + COOP/COEP headers
  // 3. MediaRecorder — universal fallback (WebM output)
  // 4. Server — ultimate fallback
  let recommendedEncoder: BrowserCapabilities['recommendedEncoder'] = 'server';

  if (hasWebCodecs) {
    recommendedEncoder = 'webcodecs';
  } else if (hasWasm && hasSharedArrayBuffer) {
    recommendedEncoder = 'wasm';
  } else if (hasMediaRecorder) {
    recommendedEncoder = 'mediarecorder';
  }

  cachedCapabilities = {
    hasWebCodecs,
    hasWasm,
    hasMediaRecorder,
    hasSharedArrayBuffer,
    cores,
    memoryGb,
    browserName,
    recommendedEncoder,
  };

  console.log('[BrowserCapabilities]', cachedCapabilities);
  return cachedCapabilities;
}

const WEIGHTS: Record<string, number> = {
  image: 1.0,
  audio: 1.2,
  text: 1.5,
  textAnim: 2.5,
  layout: 2.0,
  video: 4.0,
};

const RESOLUTION_MULTIPLIERS: Record<string, number> = {
  '480p': 0.5,
  '720p': 1.0,
  '1080p': 1.8,
  '4k': 4.0,
};

function getResMultiplier(sceneGraph: any): number {
  if (!sceneGraph?.resolution) return 1.0;
  const w = sceneGraph.resolution.w || 1280;
  const h = sceneGraph.resolution.h || 720;
  if (w >= 3840 || h >= 2160) return RESOLUTION_MULTIPLIERS['4k'];
  if (w >= 1920 || h >= 1080) return RESOLUTION_MULTIPLIERS['1080p'];
  if (w >= 1280 || h >= 720) return RESOLUTION_MULTIPLIERS['720p'];
  return RESOLUTION_MULTIPLIERS['480p'];
}

/**
 * Calculates Total Complexity Units (TCU) for a scene graph according to Complexity Score Theory.
 */
export function calculateTotalTCU(sceneGraph: any): number {
  if (!sceneGraph || !sceneGraph.tracks) return 0;
  let totalTCU = 0;
  const resMult = getResMultiplier(sceneGraph);

  for (const track of sceneGraph.tracks) {
    for (const clip of track.clips || []) {
      const type = clip.asset?.type || track.type || 'video';
      const baseWeight = WEIGHTS[type] ?? WEIGHTS.image;
      const duration = (clip.trimOut !== undefined && clip.trimIn !== undefined && clip.trimOut > clip.trimIn)
        ? (clip.trimOut - clip.trimIn)
        : ((clip.endTime - clip.startTime) || 0);
      const mult = type === 'video' ? resMult : 1.0;
      totalTCU += Math.max(0, duration) * baseWeight * mult;
    }
  }
  return totalTCU;
}

/**
 * Estimate render time in seconds based on Complexity Score Theory (TCU) and total frame count.
 * Returns estimated wall-clock seconds to render the video in-browser.
 */
export function estimateRenderTimeSec(sceneGraph: any, caps: BrowserCapabilities): number {
  const tcu = calculateTotalTCU(sceneGraph);
  
  // Base render time per TCU in browser: ~0.06 seconds per TCU for WebCodecs on 4-core machine
  const baseSecPerTCU = 0.06;

  // Hardware adjustment (4 cores baseline)
  const hardwareFactor = 4 / Math.max(caps.cores, 2);

  // Encoder multiplier: WebCodecs = 1.0, WASM = 3.0, MediaRecorder = 1.5
  const encoderFactor =
    caps.recommendedEncoder === 'webcodecs' ? 1.0 :
    caps.recommendedEncoder === 'wasm' ? 3.0 :
    caps.recommendedEncoder === 'mediarecorder' ? 1.5 : 1.0;

  const estimatedTcuSec = tcu * baseSecPerTCU * hardwareFactor * encoderFactor;

  // Frame count floor check: seeking + drawing HTML5 video element takes ~12ms per frame minimum
  const fps = sceneGraph.fps || 30;
  const duration = sceneGraph.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const minSecPerFrame = caps.recommendedEncoder === 'webcodecs' ? 0.012 : 0.035; // 12ms per frame
  const frameFloorSec = totalFrames * minSecPerFrame * hardwareFactor;

  const finalEstimate = Math.max(estimatedTcuSec, frameFloorSec);
  console.log(`[CST Estimator] Total TCU: ${tcu.toFixed(1)}, Frames: ${totalFrames}, Estimated Time: ${Math.ceil(finalEstimate)}s (${(finalEstimate / 60).toFixed(1)} min)`);
  return finalEstimate;
}

/** Threshold in seconds (7 minutes) — if estimated render exceeds this, use server */
export const BROWSER_RENDER_THRESHOLD_SEC = 7 * 60;

export function shouldRenderInBrowser(sceneGraph: any, caps: BrowserCapabilities): boolean {
  if (caps.recommendedEncoder === 'server') return false;
  const estimatedSec = estimateRenderTimeSec(sceneGraph, caps);
  return estimatedSec < BROWSER_RENDER_THRESHOLD_SEC;
}
