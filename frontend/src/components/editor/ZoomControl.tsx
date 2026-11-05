import { ZoomIn, ZoomOut } from "lucide-react";
import IconButton from "./IconButton";

interface ZoomControlProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
}

const ZoomControl: React.FC<ZoomControlProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-2 py-1 gap-2 text-xs font-mono ${className}`}
    >
      <IconButton
        onClick={onZoomOut}
        label="Zoom out"
        icon={<ZoomOut className="w-3.5 h-3.5" />}
      />

      <span className="text-slate-700 dark:text-slate-300 font-medium min-w-[36px] text-center">
        {zoomPercent}%
      </span>

      <IconButton
        onClick={onZoomIn}
        label="Zoom in"
        icon={<ZoomIn className="w-3.5 h-3.5" />}
      />
    </div>
  );
};

export default ZoomControl;
