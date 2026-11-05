import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { store } from "@/store";
import { updateClip } from "@/store/editorSlice";
import { triggerAutosave } from "@/store/thunks";
import type { Clip } from "@/types";
import { getMediaUrl } from "@/lib/api";
import { LayoutGrid, Maximize2 } from "lucide-react";

import { mediaManager } from "@/services/mediaManager";
import { getAssetFrameSnapshots, saveAssetFrameSnapshots } from "@/services/indexedDbCache";
import { drawClipToCanvas, getSortedActiveClips } from "@/services/elementRenderer";
import { SelectLayoutModal } from "./SelectLayoutModal";

interface PlayerProps {
  zoomScale?: number;
  onOpenPreview?: () => void;
}

interface MediaSeekTracker {
  isSeeking: boolean;
  pendingTime: number | null;
  lastSeekTimestamp: number;
  cleanup?: () => void;
}

export function Player({ zoomScale = 0.6, onOpenPreview }: PlayerProps) {
  const dispatch = useAppDispatch();
  const sceneGraph = useAppSelector((state) => state.editor.sceneGraph);
  const selectedClipId = useAppSelector((state) => state.editor.selectedClipId);

  const videoRefs = useRef<Map<string, HTMLMediaElement>>(new Map());
  const seekMapRef = useRef<Map<string, MediaSeekTracker>>(new Map());
  const frameCacheRef = useRef<Map<string, Map<number, HTMLCanvasElement | HTMLImageElement>>>(new Map());
  const sampledClipsRef = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

  // Interactive Canvas Bounding Box Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"move" | "resize" | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number; initialScale: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0,
    initialScale: 1.0,
  });

  // Apply layout grid presets to active media clips on canvas
  const applyLayoutPreset = (layoutId: string) => {
    if (!sceneGraph) return;
    const mediaClips: { clip: Clip; trackId: string }[] = [];
    sceneGraph.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.asset?.type === "video" || clip.asset?.type === "image") {
          mediaClips.push({ clip, trackId: track.id });
        }
      });
    });

    if (mediaClips.length === 0) return;

    mediaClips.forEach(({ clip, trackId }, idx) => {
      let x = 0;
      let y = 0;
      let width = 960;
      let height = 540;

      if (layoutId === "2:1 Horizontal") {
        height = 270;
        y = idx % 2 === 0 ? -135 : 135;
      } else if (layoutId === "2:1 Vertical") {
        width = 480;
        x = idx % 2 === 0 ? -240 : 240;
      } else if (layoutId === "3-Row") {
        height = 180;
        y = (idx % 3 - 1) * 180;
      } else if (layoutId === "3-Column") {
        width = 320;
        x = (idx % 3 - 1) * 320;
      } else if (layoutId === "4-Grid") {
        width = 480;
        height = 270;
        x = idx % 2 === 0 ? -240 : 240;
        y = Math.floor(idx / 2) % 2 === 0 ? -135 : 135;
      } else if (layoutId === "Top-BottomSplit") {
        if (idx === 0) {
          y = -135;
          height = 270;
        } else {
          y = 135;
          height = 270;
          width = 480;
          x = idx % 2 === 1 ? -240 : 240;
        }
      } else if (layoutId === "Top2-Bottom1") {
        if (idx === 2 || (mediaClips.length <= 2 && idx === 1)) {
          y = 135;
          height = 270;
        } else {
          y = -135;
          height = 270;
          width = 480;
          x = idx % 2 === 0 ? -240 : 240;
        }
      } else if (layoutId === "Left2-Right1") {
        if (idx === 2 || (mediaClips.length <= 2 && idx === 1)) {
          x = 240;
          width = 480;
        } else {
          x = -240;
          width = 480;
          height = 270;
          y = idx % 2 === 0 ? -135 : 135;
        }
      } else if (layoutId === "Left1-Right2") {
        if (idx === 0) {
          x = -240;
          width = 480;
        } else {
          x = 240;
          width = 480;
          height = 270;
          y = idx % 2 === 1 ? -135 : 135;
        }
      }

      dispatch(
        updateClip({
          trackId,
          clipId: clip.id,
          updates: {
            transform: {
              ...(clip.transform || {}),
              x,
              y,
              width,
              height,
            },
          },
        })
      );
    });

    dispatch(triggerAutosave());
  };

  // Find selected clip
  let selectedClip: Clip | null = null;
  let selectedTrackId = "";
  if (sceneGraph && selectedClipId) {
    for (const track of sceneGraph.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        selectedClip = clip;
        selectedTrackId = track.id;
        break;
      }
    }
  }

  const saveFrameSnapshot = (assetKey: string, time: number, source: HTMLVideoElement) => {
    if (!source || source.videoWidth === 0 || !assetKey) return;
    let clipMap = frameCacheRef.current.get(assetKey);
    if (!clipMap) {
      clipMap = new Map();
      frameCacheRef.current.set(assetKey, clipMap);
    }
    const key = Math.round(time * 2) / 2; // 0.5s resolution
    if (!clipMap.has(key) && clipMap.size < 300) {
      try {
        const offscreen = document.createElement("canvas");
        offscreen.width = 480;
        offscreen.height = 270;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(source, 0, 0, offscreen.width, offscreen.height);
          clipMap.set(key, offscreen);
        }
      } catch {}
    }
  };

  const triggerLocalPreSampling = (assetKey: string, blobUrl: string, duration: number) => {
    if (sampledClipsRef.current.has(assetKey) || !blobUrl.startsWith("blob:")) return;
    sampledClipsRef.current.add(assetKey);

    const offscreen = document.createElement("video");
    offscreen.src = blobUrl;
    offscreen.preload = "auto";
    offscreen.muted = true;

    const clipDuration = duration > 0 ? duration : 10;
    const step = Math.max(1, clipDuration / 25);
    let sampleSec = 0;

    const sampleNext = () => {
      if (sampleSec > clipDuration) {
        offscreen.removeAttribute("src");
        offscreen.load();
        const clipMap = frameCacheRef.current.get(assetKey);
        if (clipMap && clipMap.size > 0) {
          const framesToStore: { time: number; dataUrl: string }[] = [];
          clipMap.forEach((val, time) => {
            if (val instanceof HTMLCanvasElement) {
              try {
                framesToStore.push({ time, dataUrl: val.toDataURL("image/jpeg", 0.6) });
              } catch {}
            }
          });
          if (framesToStore.length > 0) {
            saveAssetFrameSnapshots(assetKey, framesToStore);
          }
        }
        return;
      }
      offscreen.currentTime = sampleSec;
    };

    offscreen.addEventListener(
      "loadeddata",
      () => {
        sampleNext();
      },
      { once: true }
    );

    offscreen.addEventListener("seeked", () => {
      if (offscreen.videoWidth > 0) {
        saveFrameSnapshot(assetKey, sampleSec, offscreen);
      }
      sampleSec += step;
      sampleNext();
    });
  };

  const getClosestFrame = (assetKey: string, targetTime: number): CanvasImageSource | null => {
    const clipMap = frameCacheRef.current.get(assetKey);
    if (!clipMap || clipMap.size === 0) return null;

    let closestFrame: CanvasImageSource | null = null;
    let minDiff = Infinity;

    for (const [key, frame] of clipMap.entries()) {
      const diff = Math.abs(key - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    return closestFrame;
  };

  // Full unmount cleanup
  useEffect(() => {
    return () => {
      seekMapRef.current.forEach((tracker) => {
        if (tracker.cleanup) tracker.cleanup();
      });
      seekMapRef.current.clear();
      videoRefs.current.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      videoRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!sceneGraph) return;

    const currentClipIds = new Set<string>();

    sceneGraph.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.asset.type === "video" || clip.asset.type === "audio") {
          currentClipIds.add(clip.id);

          const assetKey = clip.asset._id || clip.asset.public_id || clip.id;
          const media = videoRefs.current.get(clip.id);
          const isAudio = clip.asset.type === "audio";
          const rawUrl = getMediaUrl(clip.asset.preview_url || clip.asset.original_url);

          if (!isAudio && assetKey && !frameCacheRef.current.has(assetKey)) {
            frameCacheRef.current.set(assetKey, new Map());
            getAssetFrameSnapshots(assetKey).then((savedFrames) => {
              if (savedFrames && savedFrames.length > 0) {
                const map = frameCacheRef.current.get(assetKey) || new Map();
                savedFrames.forEach(({ time, dataUrl }) => {
                  const img = new Image();
                  img.src = dataUrl;
                  map.set(time, img);
                });
                frameCacheRef.current.set(assetKey, map);
                sampledClipsRef.current.add(assetKey);
              }
            });
          }

          if (media) {
            const cachedBlobUrl = mediaManager.getCachedBlobUrlSync(clip.asset._id, rawUrl);
            const targetUrl = cachedBlobUrl || rawUrl;
            if (targetUrl && clip.asset.preview_url && !media.src.includes(clip.asset.preview_url)) {
              const currentPos = media.currentTime;
              const wasPaused = media.paused;
              media.src = targetUrl;
              media.currentTime = currentPos;
              if (!wasPaused) media.play().catch(() => {});
            }
          } else {
            const createdMedia = document.createElement(isAudio ? "audio" : "video");
            const cachedBlobUrl = mediaManager.getCachedBlobUrlSync(clip.asset._id, rawUrl);
            createdMedia.src = cachedBlobUrl || rawUrl;
            if (createdMedia.src.startsWith("http")) {
              createdMedia.crossOrigin = "anonymous";
            }
            createdMedia.preload = "auto";
            const isMuted = clip.muted || clip.volume === 0;
            createdMedia.muted = isMuted;
            createdMedia.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.volume ?? 100) / 100));

            const tracker: MediaSeekTracker = {
              isSeeking: false,
              pendingTime: null,
              lastSeekTimestamp: 0,
            };
            seekMapRef.current.set(clip.id, tracker);

            const performSeek = (time: number) => {
              tracker.isSeeking = true;
              tracker.lastSeekTimestamp = performance.now();
              if ("fastSeek" in createdMedia && typeof (createdMedia as any).fastSeek === "function") {
                try {
                  (createdMedia as any).fastSeek(time);
                } catch {
                  createdMedia.currentTime = time;
                }
              } else {
                createdMedia.currentTime = time;
              }
            };

            const onSeeked = () => {
              tracker.isSeeking = false;
              if (createdMedia instanceof HTMLVideoElement) {
                saveFrameSnapshot(assetKey, createdMedia.currentTime, createdMedia);
              }

              if (tracker.pendingTime !== null) {
                const nextTime = tracker.pendingTime;
                tracker.pendingTime = null;
                if (Math.abs(createdMedia.currentTime - nextTime) > 0.02) {
                  performSeek(nextTime);
                }
              }
            };

            createdMedia.addEventListener("seeked", onSeeked);
            tracker.cleanup = () => createdMedia.removeEventListener("seeked", onSeeked);
            videoRefs.current.set(clip.id, createdMedia);

            mediaManager.getOrLoadMediaBlobUrl(clip.asset._id, rawUrl).then((blobUrl) => {
              if (blobUrl && createdMedia && createdMedia.src !== blobUrl) {
                const currentPos = createdMedia.currentTime;
                const wasPaused = createdMedia.paused;
                createdMedia.src = blobUrl;
                createdMedia.currentTime = currentPos;
                if (!wasPaused) createdMedia.play().catch(() => {});

                if (!isAudio) {
                  triggerLocalPreSampling(
                    assetKey,
                    blobUrl,
                    clip.asset.duration || clip.endTime - clip.startTime
                  );
                }
              }
            });

            if (cachedBlobUrl && !isAudio) {
              triggerLocalPreSampling(
                assetKey,
                cachedBlobUrl,
                clip.asset.duration || clip.endTime - clip.startTime
              );
            }
          }
        }
      });
    });

    for (const [id, media] of videoRefs.current.entries()) {
      if (!currentClipIds.has(id)) {
        const tracker = seekMapRef.current.get(id);
        if (tracker?.cleanup) tracker.cleanup();
        seekMapRef.current.delete(id);
        media.pause();
        media.removeAttribute("src");
        media.load();
        videoRefs.current.delete(id);
      }
    }
  }, [sceneGraph]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const {
        playhead: currentPlayhead,
        isPlaying: currentIsPlaying,
        sceneGraph: currentSceneGraph,
      } = store.getState().editor;

      if (!currentSceneGraph) {
        reqRef.current = requestAnimationFrame(render);
        return;
      }

      // Find all active clips across all tracks for media playback and rendering
      const activeClips = getSortedActiveClips(currentSceneGraph, currentPlayhead);

      // 1. Sync HTML video and audio element playback & seek states
      activeClips.forEach((clip) => {
        if (clip.asset.type === "video" || clip.asset.type === "audio") {
          const media = videoRefs.current.get(clip.id);
          if (media) {
            const currentClipTime = clip.trimIn + (currentPlayhead - clip.startTime);
            const isMuted = clip.muted || clip.volume === 0;
            media.muted = isMuted;
            media.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.volume ?? 100) / 100));

            if (currentIsPlaying) {
              if (media.paused) {
                media.currentTime = currentClipTime;
                media.play().catch(() => {});
              } else if (Math.abs(media.currentTime - currentClipTime) > 1.5) {
                media.currentTime = currentClipTime;
              }
            } else {
              if (!media.paused) media.pause();
              if (clip.asset.type === "audio") return;

              const tracker = seekMapRef.current.get(clip.id);
              if (tracker) {
                if (Math.abs(media.currentTime - currentClipTime) > 0.02) {
                  const now = performance.now();
                  if (media.seeking || tracker.isSeeking) {
                    tracker.pendingTime = currentClipTime;
                  } else {
                    if (now - tracker.lastSeekTimestamp >= 25) {
                      tracker.lastSeekTimestamp = now;
                      tracker.isSeeking = true;
                      if ("fastSeek" in media && typeof (media as any).fastSeek === "function") {
                        try {
                          (media as any).fastSeek(currentClipTime);
                        } catch {
                          media.currentTime = currentClipTime;
                        }
                      } else {
                        media.currentTime = currentClipTime;
                      }
                    } else {
                      tracker.pendingTime = currentClipTime;
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Pause media elements that are no longer active
      for (const [id, video] of videoRefs.current.entries()) {
        const isActive = activeClips.some((c) => c.id === id);
        if (!isActive && !video.paused) {
          video.pause();
        }
      }

      // 2. Clear canvas background
      const isDark = document.documentElement.classList.contains("dark");
      ctx.fillStyle = isDark ? "#090d16" : "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Map image elements for image clips
      const imageElementsMap = new Map<string, HTMLImageElement>();
      activeClips.forEach((c) => {
        if (c.asset.type === "image") {
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
            }
          }
        }
      });

      // 4. Render active clips using elementRenderer in Painter's algorithm order
      activeClips.forEach((clip) => {
        if (clip.asset.type === "audio") return;

        if (clip.asset.type === "video") {
          const assetKey = clip.asset._id || clip.asset.public_id || clip.id;
          const tracker = seekMapRef.current.get(clip.id);
          const currentClipTime = clip.trimIn + (currentPlayhead - clip.startTime);
          const video = videoRefs.current.get(clip.id) as HTMLVideoElement | undefined;

          if (tracker?.isSeeking) {
            // Video is seeking — draw the nearest cached frame snapshot to prevent flicker
            const cachedFrame = getClosestFrame(assetKey, currentClipTime);
            if (cachedFrame) {
              ctx.save();
              const cw = canvas.width;
              const ch = canvas.height;
              const sw = (cachedFrame as HTMLCanvasElement).width || cw;
              const sh = (cachedFrame as HTMLCanvasElement).height || ch;
              const scale = Math.min(cw / sw, ch / sh);
              const dw = sw * scale;
              const dh = sh * scale;
              const dx = (cw - dw) / 2;
              const dy = (ch - dh) / 2;
              ctx.drawImage(cachedFrame as CanvasImageSource, dx, dy, dw, dh);
              ctx.restore();
              return; // skip drawClipToCanvas for this video — already painted the cached frame
            }
          } else if (video && video.readyState >= 2) {
            saveFrameSnapshot(assetKey, currentClipTime, video);
          }
        }

        drawClipToCanvas(ctx, clip, currentPlayhead, canvas.width, canvas.height, {
          videoElements: videoRefs.current,
          imageElements: imageElementsMap,
        });
      });

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqRef.current);
  }, [dispatch]);

  // Handle Dragging Position & Scale on Canvas
  const handleMouseDown = (e: React.MouseEvent, mode: "move" | "resize") => {
    if (!selectedClip) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragMode(mode);

    const initialTransform = selectedClip.transform || {};
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: initialTransform.x ?? 0,
      initialY: initialTransform.y ?? 0,
      initialScale: initialTransform.scale ?? 1.0,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedClip || !selectedTrackId) return;

      const deltaX = (e.clientX - dragStartRef.current.mouseX) / zoomScale;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / zoomScale;

      if (dragMode === "move") {
        const newX = Math.round(dragStartRef.current.initialX + deltaX);
        const newY = Math.round(dragStartRef.current.initialY + deltaY);
        dispatch(
          updateClip({
            trackId: selectedTrackId,
            clipId: selectedClip.id,
            updates: {
              transform: {
                ...(selectedClip.transform || {}),
                x: newX,
                y: newY,
              },
            },
          })
        );
      } else if (dragMode === "resize") {
        const scaleDelta = (deltaX + deltaY) / 200;
        const newScale = Math.max(0.2, Math.min(3.0, dragStartRef.current.initialScale + scaleDelta));
        dispatch(
          updateClip({
            trackId: selectedTrackId,
            clipId: selectedClip.id,
            updates: {
              transform: {
                ...(selectedClip.transform || {}),
                scale: parseFloat(newScale.toFixed(2)),
              },
            },
          })
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragMode(null);
      dispatch(triggerAutosave());
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragMode, selectedClip, selectedTrackId, zoomScale, dispatch]);

  // Calculate selected clip bounding box position on canvas
  const selTransform = selectedClip?.transform || {};
  const selX = (selTransform.x ?? 0) + 480;
  const selY = (selTransform.y ?? 0) + 270;
  const selScale = selTransform.scale ?? 1.0;
  const selWidth = (selTransform.width || 320) * selScale;
  const selHeight = (selTransform.height || 200) * selScale;
  const selRot = selTransform.rotation ?? 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full p-6 select-none overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Left Layout Grid Icon Button */}
      <button
        onClick={() => setIsLayoutModalOpen(true)}
        title="Select Grid Layout & Split Presets"
        className="absolute top-6 left-6 w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors z-20 cursor-pointer"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {/* Top Right Fullscreen Preview Button */}
      {onOpenPreview && (
        <button
          onClick={onOpenPreview}
          title="Open Fullscreen Preview (P)"
          className="absolute top-6 right-6 w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors z-20 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}

      {/* Main Canvas Container */}
      <div
        className="relative bg-white dark:bg-slate-950 shadow-2xl rounded-sm transition-transform duration-200"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: "center center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-[960px] h-[540px] block"
        />

        {/* Selected Element Interactive Transform Bounding Box Overlay */}
        {selectedClip && (
          <div
            onMouseDown={(e) => handleMouseDown(e, "move")}
            className="absolute border-2 border-sky-400 cursor-move rounded-xs transition-opacity z-30"
            style={{
              left: `${selX - selWidth / 2}px`,
              top: `${selY - selHeight / 2}px`,
              width: `${selWidth}px`,
              height: `${selHeight}px`,
              transform: `rotate(${selRot}deg)`,
              transformOrigin: "center center",
            }}
          >
            {/* 8 Transform Control Dots for Resizing */}
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -top-2 -left-2 shadow-md cursor-nwse-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -top-2 left-1/2 -translate-x-1/2 shadow-md cursor-ns-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -top-2 -right-2 shadow-md cursor-nesw-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute top-1/2 -left-2 -translate-y-1/2 shadow-md cursor-ew-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute top-1/2 -right-2 -translate-y-1/2 shadow-md cursor-ew-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -bottom-2 -left-2 shadow-md cursor-nesw-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-md cursor-ns-resize"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, "resize")}
              className="w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full absolute -bottom-2 -right-2 shadow-md cursor-nwse-resize"
            />
          </div>
        )}
      </div>

      {/* Grid Layout & Split Presets Modal */}
      <SelectLayoutModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        onSelectLayout={(layoutId) => {
          applyLayoutPreset(layoutId);
          setIsLayoutModalOpen(false);
        }}
      />
    </div>
  );
}

export default Player;
