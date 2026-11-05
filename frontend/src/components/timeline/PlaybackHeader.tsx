import { formatTimeCode } from "@/lib/utils";
import { separateAudio, splitClip, togglePlay } from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import { Music, Pause, Play, Scissors } from "lucide-react";
interface Props {
  duration: number;
}

const PlaybackHeader: React.FC<Props> = ({ duration }) => {
  const { isPlaying, playhead } = useAppSelector((state) => state.editor);
  const dispatch = useAppDispatch();
  return (
    <div className="h-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center relative shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => dispatch(togglePlay())}
          className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        <button
          onClick={() => {
            dispatch(splitClip({}));
            dispatch(triggerAutosave());
          }}
          title="Split Clip at Playhead (S or Ctrl+K)"
          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
        >
          <Scissors className="w-3.5 h-3.5 text-sky-500" />
          <span>Split</span>
        </button>

        <button
          onClick={() => {
            dispatch(separateAudio({}));
            dispatch(triggerAutosave());
          }}
          title="Separate / Extract Audio from Video (Full Clip or Selected Region)"
          className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold flex items-center gap-1.5 border border-sky-300 dark:border-sky-800 cursor-pointer transition-colors shadow-xs"
        >
          <Music className="w-3.5 h-3.5 text-sky-500" />
          <span>Separate Sound</span>
        </button>

        <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
          {formatTimeCode(playhead)}{" "}
          <span className="text-slate-400 mx-1">|</span>{" "}
          {formatTimeCode(duration)}
        </div>
      </div>
    </div>
  );
};

export default PlaybackHeader;
