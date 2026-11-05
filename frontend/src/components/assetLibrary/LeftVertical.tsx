import { Layers, Radio, Upload as UploadIcon } from "lucide-react";
import type { ActiveRailTab } from "../AssetLibrary";
interface Props {
  handleRailClick: (tab: ActiveRailTab) => void;
  handleRailUploadClick: () => void;
  activeRailTab: ActiveRailTab;
}
const LeftVertical: React.FC<Props> = ({
  handleRailClick,
  handleRailUploadClick,
  activeRailTab,
}) => {
  return (
    <div className="w-16 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 flex flex-col items-center py-4 gap-6 shrink-0 z-20">
      <button
        onClick={handleRailUploadClick}
        className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
          activeRailTab === "upload"
            ? "text-sky-500 font-semibold"
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        }`}
      >
        <div
          className={`p-2.5 rounded-xl ${
            activeRailTab === "upload"
              ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
              : ""
          }`}
        >
          <UploadIcon className="w-5 h-5" />
        </div>
        <span className="text-[10px]">Upload</span>
      </button>

      <button
        onClick={() => handleRailClick("elements")}
        className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
          activeRailTab === "elements"
            ? "text-sky-500 font-semibold"
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        }`}
      >
        <div
          className={`p-2.5 rounded-xl ${
            activeRailTab === "elements"
              ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
              : ""
          }`}
        >
          <Layers className="w-5 h-5" />
        </div>
        <span className="text-[10px]">Elements</span>
      </button>

      <button
        onClick={() => handleRailClick("live")}
        className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
          activeRailTab === "live"
            ? "text-sky-500 font-semibold"
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        }`}
      >
        <div
          className={`p-2.5 rounded-xl ${
            activeRailTab === "live"
              ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
              : ""
          }`}
        >
          <Radio className="w-5 h-5" />
        </div>
        <span className="text-[10px]">Live</span>
      </button>
    </div>
  );
};

export default LeftVertical;
