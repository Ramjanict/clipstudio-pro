import { getMediaUrl } from "@/lib/api";
import type { Asset } from "@/types";
import { AlertTriangle, Film, Loader2, Trash2, X } from "lucide-react";
import React from "react";
interface Props {
  isDeleting: boolean;
  setAssetToDelete: React.Dispatch<React.SetStateAction<Asset | null>>;
  assetToDelete: Asset | null;
  handleConfirmDelete: () => void;
}

const DeleteWarning: React.FC<Props> = ({
  isDeleting,
  setAssetToDelete,
  assetToDelete,
  handleConfirmDelete,
}) => {
  return (
    assetToDelete && (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={() => !isDeleting && setAssetToDelete(null)}
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-150 flex flex-col items-center text-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Close Button */}
          <button
            onClick={() => !isDeleting && setAssetToDelete(null)}
            disabled={isDeleting}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Warning Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {assetToDelete.type === "export"
              ? "Delete Exported Video?"
              : "Delete Media Asset?"}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
            {assetToDelete.type === "export"
              ? "This exported video will be permanently removed from your server storage. You will not be able to download or stream it again."
              : "Are you sure you want to delete this media file from your library? This action cannot be undone."}
          </p>

          {/* File Info Card */}
          <div className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 mb-5 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative border border-slate-200/60 dark:border-slate-700/60">
              {assetToDelete.type === "video" ||
              assetToDelete.type === "export" ? (
                <video
                  src={getMediaUrl(
                    assetToDelete.preview_url || assetToDelete.original_url,
                  )}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
              ) : assetToDelete.type === "image" ? (
                <img
                  src={getMediaUrl(
                    assetToDelete.preview_url || assetToDelete.original_url,
                  )}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Film className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {assetToDelete.public_id ||
                  assetToDelete.original_url.split("/").pop() ||
                  "Video"}
              </span>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="capitalize">{assetToDelete.type}</span>
                {assetToDelete.duration && (
                  <>
                    <span>•</span>
                    <span>{Math.round(assetToDelete.duration)}s</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setAssetToDelete(null)}
              disabled={isDeleting}
              className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-rose-500/20 disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  );
};

export default DeleteWarning;
