import { formatTimeCode } from "@/lib/utils";
import {
  addAssetToTimeline,
  addTrack,
  deleteTrack,
  setPlayhead,
  setSelectedClip,
  splitClip,
} from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import type { Clip } from "@/types";
import {
  Home,
  Plus,
  Scissors,
  Trash2,
  Type,
  Video,
  Volume2,
} from "lucide-react";
import ActionButton from "../shared/ActionButton";
import PlayHeadIndicator from "./PlayHeadIndicator";

interface Props {
  visualDuration: number;
  pixelsPerSecond: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handlePlayHeadMouseDown: (e: React.MouseEvent) => void;
  visualMinutes: number;
  handleClipMouseDown: (
    e: React.MouseEvent,
    clip: Clip,
    trackId: string,
  ) => void;
}
const ScrollableTimeline: React.FC<Props> = ({
  scrollContainerRef,
  visualDuration,
  pixelsPerSecond,
  handlePlayHeadMouseDown,
  visualMinutes,
  handleClipMouseDown,
}) => {
  const { sceneGraph, selectedClipId, playhead } = useAppSelector(
    (state) => state.editor,
  );

  const dispatch = useAppDispatch();
  if (!sceneGraph)
    return (
      <div className="h-full bg-white dark:bg-slate-900 p-4 text-slate-400">
        No project loaded
      </div>
    );
  return (
    <div
      id="timeline-scroll-container"
      className="flex-1 overflow-auto flex flex-col relative"
      ref={scrollContainerRef}
    >
      {/* Page / Layout Badges Header Line */}
      <div
        className="sticky top-0 z-30 h-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center w-max min-w-full"
        style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
      >
        {/* Left Home Icon Pill */}
        <button
          onClick={() => dispatch(setPlayhead(0))}
          title="Reset Playhead to Start"
          className="w-12 h-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white flex items-center justify-center shrink-0 sticky left-0 z-40 cursor-pointer transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 px-3 py-1">
          <ActionButton
            onClick={() => {
              dispatch(addTrack({ type: "video" }));
              dispatch(triggerAutosave());
            }}
            title="Add New Video Track"
            icon={Plus}
            label="Add Video Track"
            size="sm"
          />
          <ActionButton
            onClick={() => {
              dispatch(addTrack({ type: "audio" }));
              dispatch(triggerAutosave());
            }}
            color="emerald"
            title="Add New Audio Track"
            icon={Plus}
            label="Add Audio Track"
            size="sm"
          />
        </div>
      </div>

      {/* Ruler Bar (Exact Figma Match from media_1789275976556.png) */}
      <div
        onMouseDown={handlePlayHeadMouseDown}
        className="sticky top-10 z-30 h-9 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shrink-0 flex w-max min-w-full cursor-pointer select-none"
        style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
      >
        <div className="w-12 shrink-0 bg-slate-50 dark:bg-slate-950 sticky left-0 z-40 border-r border-slate-200 dark:border-slate-800 border-t border-slate-200 dark:border-slate-800"></div>
        <div
          className="flex-1 relative"
          style={{ width: `${visualDuration * pixelsPerSecond}px` }}
        >
          {Array.from({ length: visualMinutes + 1 }).map((_, m) => {
            const minuteSecond = m * 60;
            return (
              <div key={`m_${m}`}>
                {/* Major 1-minute tick (Full height line + 01:00 text) */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: `${minuteSecond * pixelsPerSecond}px` }}
                >
                  <div className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-slate-600" />
                  <span className="absolute bottom-0.5 left-1 text-[12px] text-slate-400 dark:text-slate-400 font-mono tracking-tight leading-none select-none">
                    {formatTimeCode(minuteSecond)}
                  </span>
                </div>

                {/* 9 Minor sub-ticks between minutes */}
                {m < visualMinutes &&
                  Array.from({ length: 9 }).map((_, sub) => {
                    const subSecond = minuteSecond + (sub + 1) * 6;
                    return (
                      <div
                        key={`sub_${m}_${sub}`}
                        className="absolute top-0 h-2 border-l border-slate-300/80 dark:border-slate-700/80"
                        style={{ left: `${subSecond * pixelsPerSecond}px` }}
                      />
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Track Lanes */}
      <div
        className="flex-1 relative pb-10 w-max min-w-full"
        style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
      >
        {sceneGraph.tracks.map((track) => (
          <div
            key={track.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const rawData = e.dataTransfer.getData("application/json");
              if (rawData) {
                try {
                  const asset = JSON.parse(rawData);
                  const container = document.getElementById(
                    "timeline-scroll-container",
                  );
                  const scrollLeft = container ? container.scrollLeft : 0;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropX = e.clientX - rect.left + scrollLeft - 48;
                  const dropTime = Math.max(0, dropX / pixelsPerSecond);

                  dispatch(
                    addAssetToTimeline({
                      asset,
                      trackId: track.id,
                      startTime: dropTime,
                    }),
                  );
                  dispatch(triggerAutosave());
                } catch (err) {
                  console.error("Drop error", err);
                }
              }
            }}
            className="flex h-14 border-b border-slate-200 dark:border-slate-800/80 relative hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
          >
            {/* Track Header Icon (Sticky Left - High Z-Index to prevent clipping) */}
            <div className="w-12 bg-white dark:bg-slate-900 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 shrink-0 text-slate-500 dark:text-slate-400 z-30 sticky left-0 shadow-xs h-full group relative">
              {track.type === "audio" ? (
                <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : track.type === "text" ? (
                <Type className="w-4 h-4 text-purple-500 shrink-0" />
              ) : (
                <Video className="w-4 h-4 text-sky-500 shrink-0" />
              )}

              {sceneGraph.tracks.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(deleteTrack(track.id));
                    dispatch(triggerAutosave());
                  }}
                  title="Delete Track"
                  className="absolute inset-0 bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-40 rounded-xs"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Track Clip Canvas */}
            <div className="flex-1 relative z-10 overflow-hidden">
              {track.clips.map((clip) => {
                const isSelected = selectedClipId === clip.id;
                const isAudio = clip.asset.type === "audio";
                const isText = clip.asset.type === "text";

                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setSelectedClip(clip.id));
                    }}
                    onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
                    className={`absolute top-2 bottom-2 rounded-xl border flex items-center px-3 text-xs cursor-grab active:cursor-grabbing transition-all ${
                      isAudio
                        ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500 shadow-xs"
                        : isText
                          ? "bg-purple-50 dark:bg-purple-950/40 border-purple-400 text-purple-700 dark:text-purple-300"
                          : "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-800 dark:text-amber-300"
                    } ${isSelected ? "ring-2 ring-sky-500 shadow-md z-10" : ""}`}
                    style={{
                      left: `${clip.startTime * pixelsPerSecond}px`,
                      width: `${(clip.endTime - clip.startTime) * pixelsPerSecond}px`,
                    }}
                  >
                    {isAudio && (
                      <Volume2 className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-90" />
                    )}
                    <span className="truncate flex-1 font-medium">
                      {isText
                        ? clip.asset.content || "Text"
                        : clip.asset.public_id ||
                          clip.asset.original_url.split("/").pop() ||
                          "Clip"}
                    </span>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(
                            splitClip({
                              trackId: track.id,
                              clipId: clip.id,
                              splitAtTime: playhead,
                            }),
                          );
                          dispatch(triggerAutosave());
                        }}
                        title="Split clip at playhead"
                        className="ml-1 p-1 rounded hover:bg-black/20 dark:hover:bg-white/20 text-current shrink-0 cursor-pointer"
                      >
                        <Scissors className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <PlayHeadIndicator
        handlePlayHeadMouseDown={handlePlayHeadMouseDown}
        pixelsPerSecond={pixelsPerSecond}
      />
    </div>
  );
};

export default ScrollableTimeline;
