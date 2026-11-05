import React from "react";
import { X } from "lucide-react";

interface SelectLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLayout: (layoutId: string) => void;
  currentLayout?: string;
}

export const LAYOUT_OPTIONS = [
  { id: "2:1 Horizontal", label: "2-Row Split", icon: (
    <div className="w-full h-full flex flex-col gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "2:1 Vertical", label: "2-Column Split", icon: (
    <div className="w-full h-full flex gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "3-Row", label: "3-Row Stack", icon: (
    <div className="w-full h-full flex flex-col gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "3-Column", label: "3-Column Stack", icon: (
    <div className="w-full h-full flex gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "Top-BottomSplit", label: "Top 1 / Bottom 2", icon: (
    <div className="w-full h-full flex flex-col gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 flex gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
    </div>
  )},
  { id: "Top2-Bottom1", label: "Top 2 / Bottom 1", icon: (
    <div className="w-full h-full flex flex-col gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 flex gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "4-Grid", label: "4 Grid", icon: (
    <div className="w-full h-full flex flex-col gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 flex gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
      <div className="flex-1 flex gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
    </div>
  )},
  { id: "Left2-Right1", label: "Left 2 / Right 1", icon: (
    <div className="w-full h-full flex gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
    </div>
  )},
  { id: "Left1-Right2", label: "Left 1 / Right 2", icon: (
    <div className="w-full h-full flex gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded">
      <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
        <div className="flex-1 bg-slate-400 dark:bg-slate-500 rounded-sm"></div>
      </div>
    </div>
  )}
];

export const SelectLayoutModal: React.FC<SelectLayoutModalProps> = ({
  isOpen,
  onClose,
  onSelectLayout,
  currentLayout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Select Layout</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
            {LAYOUT_OPTIONS.map((layout) => {
              const isSelected = currentLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => {
                    onSelectLayout(layout.id);
                    onClose();
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30 shadow-md ring-2 ring-sky-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="w-16 h-12 mb-2">
                    {layout.icon}
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 text-center truncate w-full">
                    {layout.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
