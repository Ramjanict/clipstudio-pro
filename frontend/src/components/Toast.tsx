import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { removeToast } from "@/store/uiSlice";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import type { ToastType } from "@/store/uiSlice";

const ICONS: Record<ToastType, React.ReactElement> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
  error: <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />,
  info: <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
};

const BG: Record<ToastType, string> = {
  success: "bg-white dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-100",
  error: "bg-white dark:bg-red-950/90 border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-100",
  info: "bg-white dark:bg-slate-900/95 border-slate-200 dark:border-slate-600/40 text-slate-800 dark:text-slate-100",
  warning: "bg-white dark:bg-amber-950/90 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-100",
};

function ToastItem({ id, type, message }: { id: string; type: ToastType; message: string }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = setTimeout(() => dispatch(removeToast(id)), 4000);
    return () => clearTimeout(timer);
  }, [id, dispatch]);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm text-xs min-w-[260px] max-w-[400px] ${BG[type]}`}>
      {ICONS[type]}
      <span className="flex-1 font-medium leading-tight">{message}</span>
      <button onClick={() => dispatch(removeToast(id))} className="text-slate-400 hover:text-slate-600 dark:hover:text-white ml-1 shrink-0 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function Toast() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem id={t.id} type={t.type} message={t.message} />
        </div>
      ))}
    </div>
  );
}
