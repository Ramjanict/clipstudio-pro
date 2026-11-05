import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  uploadPercent: number;
  label?: string;
  className?: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  uploadPercent,
  label = "Uploading video",
  className = "",
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl text-sky-600 dark:text-sky-300 text-xs font-medium animate-pulse shadow-xs ${className}`}
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />

      <span>
        {label} ({uploadPercent}%)
      </span>
    </div>
  );
};

export default UploadProgress;
