import { ArrowLeft } from "lucide-react";

interface EditorHeaderProps {
  title: string;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  backLabel?: string;
  className?: string;
}

const EditorHeaderTemplate: React.FC<EditorHeaderProps> = ({
  title,
  onBack,
  onTitleChange,
  backLabel = "Editor",
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white hover:text-sky-500 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent focus:outline-none focus:border-b focus:border-sky-500 py-0.5 px-1 max-w-[200px]"
      />
    </div>
  );
};

export default EditorHeaderTemplate;
