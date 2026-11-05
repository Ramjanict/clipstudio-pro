import type { LucideIcon } from "lucide-react";

interface HistoryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  title?: string;
  className?: string;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({
  onClick,
  disabled = false,
  icon: Icon,
  title,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

export default HistoryButton;
