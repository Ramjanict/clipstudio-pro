import { Shield } from "lucide-react";

interface AdminButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

const AdminButton: React.FC<AdminButtonProps> = ({
  onClick,
  label = "Admin",
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl border border-purple-300 dark:border-purple-800 flex items-center gap-1.5 cursor-pointer ${className}`}
    >
      <Shield className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
};

export default AdminButton;
