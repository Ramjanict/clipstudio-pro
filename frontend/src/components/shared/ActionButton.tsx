import type { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  disabledTitle?: string;
  title?: string;
  color?: "sky" | "emerald" | "rose" | "slate";
  size?: "xs" | "sm" | "md" | "lg" | "round";
  variant?: "solid" | "outline";
  className?: string;
}

const sizeClasses: Record<NonNullable<ActionButtonProps["size"]>, string> = {
  xs: "px-2 py-1 text-[10px] rounded-md gap-1",
  sm: "px-2.5 py-1.5 text-[11px] rounded-lg gap-1",
  md: "px-4 py-2 text-xs rounded-xl gap-1.5",
  lg: "px-5 py-2.5 text-sm rounded-2xl gap-2",
  round: "px-3 py-1.5 text-xs rounded-full gap-1.5",
};

const iconSizeClasses: Record<
  NonNullable<ActionButtonProps["size"]>,
  string
> = {
  xs: "w-2.5 h-2.5",
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
  round: "w-3.5 h-3.5",
};

const colorClasses: Record<
  NonNullable<ActionButtonProps["color"]>,
  {
    solid: string;
    outline: string;
  }
> = {
  sky: {
    solid: "bg-sky-500 hover:bg-sky-400 text-white",
    outline: "border border-sky-400 text-sky-500 hover:bg-sky-50",
  },

  emerald: {
    solid: "bg-emerald-500 hover:bg-emerald-400 text-white",
    outline: "border border-emerald-400 text-emerald-500 hover:bg-emerald-50",
  },

  rose: {
    solid: "bg-rose-500 hover:bg-rose-400 text-white",
    outline: "border border-rose-400 text-rose-500 hover:bg-rose-50",
  },

  slate: {
    solid: "bg-slate-500 hover:bg-slate-400 text-white",
    outline: "border border-slate-400 text-slate-500 hover:bg-slate-50",
  },
};

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  label,
  icon: Icon,
  disabled = false,
  disabledTitle,
  title,
  color = "sky",
  size = "md",
  variant = "solid",
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? (disabledTitle ?? title) : title}
      className={`
        ${sizeClasses[size]}
        ${colorClasses[color][variant]}
        font-semibold
        shadow-sm
        transition-all
        flex items-center justify-center
        ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {Icon && <Icon className={iconSizeClasses[size]} />}
      <span>{label}</span>
    </button>
  );
};

export default ActionButton;
