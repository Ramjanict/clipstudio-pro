import {
  deleteClip,
  moveClip,
  redo,
  setPlayhead,
  setSelectedClip,
  splitClip,
  togglePlay,
  undo,
} from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import type { Clip } from "@/types";
import { useEffect, useRef, useState } from "react";
import PlaybackHeader from "./timeline/PlaybackHeader";
import ScrollableTimeline from "./timeline/ScrollableTimeline";

const pixelsPerSecond = 200 / 60; // 200px per minute scale matching Figma

export function Timeline() {
  const dispatch = useAppDispatch();
  const { sceneGraph, selectedClipId, playhead, isPlaying } = useAppSelector(
    (state) => state.editor,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalTrackId: string;
  } | null>(null);

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    let rafId: number | null = null;
    let pendingX: number | null = null;

    const commitPlayhead = () => {
      if (pendingX !== null) {
        dispatch(setPlayhead(pendingX / pixelsPerSecond));
        pendingX = null;
      }
      rafId = null;
    };

    const updatePlayhead = (moveEvent: MouseEvent) => {
      const container = document.getElementById("timeline-scroll-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        let newX = moveEvent.clientX - rect.left + container.scrollLeft - 48;
        newX = Math.max(0, newX);

        if (moveEvent.clientX > rect.right - 50) {
          container.scrollLeft += 15;
        } else if (moveEvent.clientX < rect.left + 80) {
          container.scrollLeft -= 15;
        }

        pendingX = newX;
        if (rafId === null) {
          rafId = requestAnimationFrame(commitPlayhead);
        }
      }
    };

    updatePlayhead(e.nativeEvent);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      commitPlayhead();
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      updatePlayhead(moveEvent);
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        commitPlayhead();
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;

  const duration = sceneGraph?.duration ?? 0;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    let animationFrameId: number;
    if (isPlaying) {
      let lastTime = performance.now();
      const update = (now: number) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        const nextPlayhead = playheadRef.current + delta;

        if (durationRef.current > 0 && nextPlayhead >= durationRef.current) {
          dispatch(setPlayhead(0));
          dispatch(togglePlay());
          return;
        }

        dispatch(setPlayhead(nextPlayhead));
        animationFrameId = requestAnimationFrame(update);
      };
      animationFrameId = requestAnimationFrame(update);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.key === "Backspace" || e.key === "Delete") && selectedClipId) {
        dispatch(deleteClip(selectedClipId));
        dispatch(triggerAutosave());
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        dispatch(togglePlay());
        return;
      }
      if (
        e.key.toLowerCase() === "s" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        dispatch(splitClip({}));
        dispatch(triggerAutosave());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
        dispatch(triggerAutosave());
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        dispatch(redo());
        dispatch(triggerAutosave());
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, dispatch]);

  // Clip mouse drag move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState && containerRef.current && sceneGraph) {
        const deltaX = e.clientX - dragState.startX;
        const deltaSeconds = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(
          0,
          dragState.originalStartTime + deltaSeconds,
        );

        const rect = containerRef.current.getBoundingClientRect();
        let trackIndex = Math.floor((e.clientY - rect.top - 80) / 60);
        trackIndex = Math.max(
          0,
          Math.min(trackIndex, sceneGraph.tracks.length - 1),
        );
        const targetTrack = sceneGraph.tracks[trackIndex];

        // Find clip to check type
        let currentClip: Clip | undefined;
        for (const t of sceneGraph.tracks) {
          const c = t.clips.find((clip) => clip.id === dragState.clipId);
          if (c) {
            currentClip = c;
            break;
          }
        }

        let newTrackId = dragState.originalTrackId;
        if (currentClip && targetTrack) {
          const isAudioClip = currentClip.asset?.type === "audio";
          const isTargetAudio = targetTrack.type === "audio";
          // Strictly enforce: Audio clips -> Audio tracks, Video/Image clips -> Video tracks
          if (isAudioClip === isTargetAudio) {
            newTrackId = targetTrack.id;
          }
        }

        // Auto-scroll timeline when dragging near viewport right/left edges
        const scrollContainer = document.getElementById(
          "timeline-scroll-container",
        );
        if (scrollContainer) {
          const scrollRect = scrollContainer.getBoundingClientRect();
          if (e.clientX > scrollRect.right - 50) {
            scrollContainer.scrollLeft += 15;
          } else if (e.clientX < scrollRect.left + 80) {
            scrollContainer.scrollLeft -= 15;
          }
        }

        dispatch(
          moveClip({ clipId: dragState.clipId, newStartTime, newTrackId }),
        );
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
        dispatch(triggerAutosave());
      }
    };

    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, dispatch, sceneGraph]);

  if (!sceneGraph)
    return (
      <div className="h-full bg-white dark:bg-slate-900 p-4 text-slate-400">
        No project loaded
      </div>
    );

  const visualMinutes = Math.max(
    5,
    Math.ceil(((duration > 0 ? duration : 60) + 60) / 60),
  );
  const visualDuration = visualMinutes * 60;

  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: Clip,
    trackId: string,
  ) => {
    e.stopPropagation();
    dispatch(setSelectedClip(clip.id));
    setDragState({
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      originalStartTime: clip.startTime,
      originalTrackId: trackId,
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 select-none overflow-hidden"
      ref={containerRef}
    >
      <PlaybackHeader duration={duration} />

      <ScrollableTimeline
        scrollContainerRef={scrollContainerRef}
        visualDuration={visualDuration}
        pixelsPerSecond={pixelsPerSecond}
        handlePlayHeadMouseDown={handlePlayheadMouseDown}
        visualMinutes={visualMinutes}
        handleClipMouseDown={handleClipMouseDown}
      />
    </div>
  );
}

export default Timeline;
