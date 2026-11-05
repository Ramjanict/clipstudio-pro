import React, { useState } from "react";
import { X, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, RotateCw, MoveRight, Layers } from "lucide-react";

interface AnimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnimation: (anim: { category: string; type: string }) => void;
  currentAnimation?: string;
}

export const AnimationModal: React.FC<AnimationModalProps> = ({
  isOpen,
  onClose,
  onSelectAnimation,
  currentAnimation,
}) => {
  const [activeTab, setActiveTab] = useState<"Enter" | "Emphasis" | "Exit">("Enter");

  if (!isOpen) return null;

  const animationItems = [
    { name: "Fade In", icon: <div className="w-8 h-8 rounded bg-slate-300 dark:bg-slate-600 opacity-60 animate-pulse" /> },
    { name: "Enter Left", icon: <ArrowRight className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Enter Right", icon: <ArrowLeft className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Enter Up", icon: <ArrowUp className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Enter Down", icon: <ArrowDown className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Rotate In", icon: <RotateCw className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Flip X", icon: <div className="w-8 h-6 rounded bg-slate-300 dark:bg-slate-600 transform scale-x-75" /> },
    { name: "Flip Y", icon: <div className="w-6 h-8 rounded bg-slate-300 dark:bg-slate-600 transform scale-y-75" /> },
    { name: "Flip", icon: <Layers className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
    { name: "Zoom In", icon: <div className="w-6 h-6 rounded bg-sky-400 scale-125 transition-transform" /> },
    { name: "Roll In", icon: <RotateCw className="w-6 h-6 text-sky-400" /> },
    { name: "Slide In", icon: <MoveRight className="w-6 h-6 text-slate-500 dark:text-slate-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          {/* Pill Tabs: Enter | Emphasis | Exit */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-full border border-slate-200 dark:border-slate-700/60 text-xs font-medium w-full max-w-md">
            <button
              onClick={() => setActiveTab("Enter")}
              className={`flex-1 py-2 px-4 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "Enter"
                  ? "bg-white dark:bg-slate-900 text-sky-500 font-semibold shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Enter</span>
            </button>
            <button
              onClick={() => setActiveTab("Emphasis")}
              className={`flex-1 py-2 px-4 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "Emphasis"
                  ? "bg-white dark:bg-slate-900 text-sky-500 font-semibold shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="font-mono text-sm">≡</span>
              <span>Emphasis</span>
            </button>
            <button
              onClick={() => setActiveTab("Exit")}
              className={`flex-1 py-2 px-4 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "Exit"
                  ? "bg-white dark:bg-slate-900 text-sky-500 font-semibold shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-4 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4x3 Grid */}
        <div className="grid grid-cols-4 gap-6 py-4">
          {animationItems.map((item) => {
            const isSelected = currentAnimation === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  onSelectAnimation({ category: activeTab, type: item.name });
                  onClose();
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-950/40 text-sky-500 ring-2 ring-sky-500"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 shadow-xs">
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-center">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
