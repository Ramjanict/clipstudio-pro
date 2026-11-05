import { getMediaUrl } from "@/lib/api";
import { formatTimeCode } from "@/lib/utils";
import { drawClipToCanvas, getSortedActiveClips } from "@/services/elementRenderer";
import { store } from "@/store";
import { setPlayhead, togglePlay } from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PreviewModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { sceneGraph, playhead, isPlaying } = useAppSelector(
    (state) => state.editor,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLMediaElement>>(new Map());
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const duration = sceneGraph?.duration && sceneGraph.duration > 0 ? sceneGraph.duration : 1;

  // Handle closing with cleanup
  const handleClose = () => {
    if (isPlaying) {
      dispatch(togglePlay());
    }
    videoRefs.current.forEach((media) => {
      media.pause();
    });
    onClose();
  };

  // Keyboard navigation within the Preview Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        dispatch(togglePlay());
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        dispatch(setPlayhead(Math.max(0, playhead - step)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        dispatch(setPlayhead(Math.min(duration, playhead + step)));
      } else if (e.key === "Home") {
        e.preventDefault();
        dispatch(setPlayhead(0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, playhead, duration, isPlaying]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Setup media elements (video & audio)
  useEffect(() => {
    if (!sceneGraph) return;

    sceneGraph.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (
          (clip.asset.type === "video" || clip.asset.type === "audio") &&
          !videoRefs.current.has(clip.id)
        ) {
          const isAudio = clip.asset.type === "audio";
          const media = document.createElement(isAudio ? "audio" : "video");
          const url = getMediaUrl(clip.asset.preview_url || clip.asset.original_url);
          media.src = url;
          if (url.startsWith("http")) {
            media.crossOrigin = "anonymous";
          }
          media.preload = "auto";
          media.muted = !!clip.muted;
          media.volume = typeof clip.volume === "number" ? clip.volume : 1.0;
          if (!isAudio) {
            (media as HTMLVideoElement).playsInline = true;
          }

          videoRefs.current.set(clip.id, media);
          videoRefs.current.set(clip.assetId, media);
          if (clip.asset._id) {
            videoRefs.current.set(clip.asset._id, media);
          }
        }
      });
    });

    return () => {
      videoRefs.current.forEach((media) => {
        media.pause();
        media.removeAttribute("src");
        media.load();
      });
      videoRefs.current.clear();
    };
  }, [sceneGraph]);

  // Main high-fidelity render loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const {
        playhead: currentPlayhead,
        isPlaying: currentIsPlaying,
        sceneGraph: currentSceneGraph,
      } = store.getState().editor;

      if (!currentSceneGraph) return;

      // 1. Clear canvas background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Preload & cache any required images
      const imageElementsMap = new Map<string, HTMLImageElement>();
      currentSceneGraph.tracks.forEach((track) => {
        track.clips.forEach((c) => {
          if (c.asset?.type === "image") {
            const url = getMediaUrl(c.asset.preview_url || c.asset.original_url);
            if (url) {
              let img = imageCache.current[url];
              if (!img) {
                img = new Image();
                img.crossOrigin = "anonymous";
                img.src = url;
                imageCache.current[url] = img;
              }
              if (img.complete && img.width > 0) {
                imageElementsMap.set(c.id, img);
                imageElementsMap.set(c.assetId, img);
                if (c.asset._id) imageElementsMap.set(c.asset._id, img);
              }
            }
          }
        });
      });

      // 3. Find sorted active clips in correct painter's algorithm order
      const activeClips = getSortedActiveClips(currentSceneGraph, currentPlayhead);

      // 4. Synchronize video & audio elements with current playhead
      currentSceneGraph.tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          if (clip.asset.type === "video" || clip.asset.type === "audio") {
            const media = videoRefs.current.get(clip.id);
            if (!media) return;

            const isActive =
              currentPlayhead >= clip.startTime && currentPlayhead <= clip.endTime;

            if (isActive) {
              const currentClipTime =
                clip.trimIn + (currentPlayhead - clip.startTime);

              if (currentIsPlaying) {
                if (media.paused) {
                  media.currentTime = currentClipTime;
                  media.play().catch(() => {});
                } else if (Math.abs(media.currentTime - currentClipTime) > 0.35) {
                  media.currentTime = currentClipTime;
                }
              } else {
                if (!media.paused) {
                  media.pause();
                }
                if (Math.abs(media.currentTime - currentClipTime) > 0.04) {
                  media.currentTime = currentClipTime;
                }
              }
            } else {
              if (!media.paused) {
                media.pause();
              }
            }
          }
        });
      });

      // 5. Draw all active clips with full formatting, shapes, text, transforms
      activeClips.forEach((clip) => {
        if (clip.asset.type === "audio") return;

        drawClipToCanvas(
          ctx,
          clip,
          currentPlayhead,
          canvas.width,
          canvas.height,
          {
            videoElements: videoRefs.current,
            imageElements: imageElementsMap,
          },
        );
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Scrubber seeking calculations
  const seekFromMouseEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;
    dispatch(setPlayhead(targetTime));
  };

  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    seekFromMouseEvent(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      seekFromMouseEvent(moveEvent);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const progressPercent = Math.min(100, Math.max(0, (playhead / duration) * 100));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 z-[100] flex flex-col select-none text-white backdrop-blur-sm"
    >
      {/* Top Header Bar */}
      <div className="h-14 shrink-0 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-wide text-white">
            Project Preview
          </span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
            1920 × 1080 • 16:9
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleClose}
            title="Close Preview (Esc)"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Canvas Viewport */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-6 relative">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="max-w-full max-h-full aspect-video object-contain rounded-xl shadow-2xl bg-black border border-white/10"
        />
      </div>

      {/* Bottom Controls Bar */}
      <div className="shrink-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-6 pt-2 flex flex-col gap-3 z-10">
        {/* Interactive Scrubber Bar */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          className="w-full h-4 group flex items-center cursor-pointer relative"
        >
          <div className="w-full h-1.5 group-hover:h-2 bg-white/20 rounded-full relative transition-all overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Draggable thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border border-sky-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{
              left: `calc(${progressPercent}% - 7px)`,
              opacity: isScrubbing ? 1 : undefined,
            }}
          />
        </div>

        {/* Playback Controls & Timecode */}
        <div className="flex items-center justify-between">
          {/* Left: Time display */}
          <div className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
            <span className="font-semibold text-white">
              {formatTimeCode(playhead)}
            </span>
            <span className="text-white/40">/</span>
            <span>{formatTimeCode(duration)}</span>
          </div>

          {/* Center: Playback Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch(setPlayhead(0))}
              title="Reset to Start (Home)"
              className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => dispatch(setPlayhead(Math.max(0, playhead - 5)))}
              title="Backward 5s (Shift+Left)"
              className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => dispatch(togglePlay())}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="w-11 h-11 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => dispatch(setPlayhead(Math.min(duration, playhead + 5)))}
              title="Forward 5s (Shift+Right)"
              className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Quick Hint */}
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Space</kbd> to Play/Pause • <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> to Exit
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreviewModal;
