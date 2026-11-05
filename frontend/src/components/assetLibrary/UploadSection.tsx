import ActionButton from "@/components/shared/ActionButton";
import { getMediaUrl } from "@/lib/api";
import { downloadMediaFile } from "@/lib/utils";
import { mediaManager } from "@/services/mediaManager";
import { removeOptimisticAsset, type UploadingItem } from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToast } from "@/store/uiSlice";
import type { Asset } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Search,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import type { ActiveFilterTab } from "../AssetLibrary";
interface UploadSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  activeFilterTab: ActiveFilterTab;
  setActiveFilterTab: (tab: ActiveFilterTab) => void;
  activeUploadsList: UploadingItem[];
  filteredAssets: Asset[];
  handleAddToTimeline: (asset: Asset) => void;
  handleDeleteClick: (e: React.MouseEvent, asset: Asset) => void;
}
const UploadSection: React.FC<UploadSectionProps> = ({
  fileInputRef,
  handleUpload,
  searchQuery,
  setSearchQuery,
  activeFilterTab,
  setActiveFilterTab,
  activeUploadsList,
  filteredAssets,
  handleAddToTimeline,
  handleDeleteClick,
}) => {
  const dispatch = useAppDispatch();
  const { uploadingAssets } = useAppSelector((state) => state.editor);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
            My Resource
          </h2>

          <ActionButton
            label="Upload"
            icon={UploadIcon}
            onClick={() => fileInputRef.current?.click()}
          />

          <input
            type="file"
            accept="video/*,image/*,audio/*,.mp4,.webm,.mov,.avi,.mkv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.aac"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
            multiple
          />
        </div>

        {/* Search Device Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Device"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-4 text-xs font-medium border-b border-slate-100 dark:border-slate-800 pb-1 overflow-x-auto">
          {(["All", "Image", "Video", "Audio", "Exports"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilterTab(tab)}
                className={`pb-1 transition-colors relative cursor-pointer shrink-0 ${
                  activeFilterTab === tab
                    ? "text-sky-500 font-semibold"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                {tab}
                {activeFilterTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
                )}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Active Uploads Banner */}
      {activeUploadsList.length > 0 && (
        <div className="p-3 bg-sky-50/90 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/50 flex flex-col gap-2">
          {activeUploadsList.map((item) => (
            <div key={item.tempId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : item.status === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
                  )}
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                    {item.fileName}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                  {item.status === "completed"
                    ? "Uploaded!"
                    : item.status === "error"
                      ? "Failed"
                      : item.status === "processing"
                        ? "Processing..."
                        : `${item.progress}%`}
                </span>
              </div>
              {item.status !== "completed" && item.status !== "error" && (
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-sky-500 h-full transition-all duration-200 rounded-full"
                    style={{
                      width: `${Math.max(5, item.progress)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Grid of Assets */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 auto-rows-max content-start">
        {filteredAssets.map((asset) => {
          const uploadItem = uploadingAssets[asset._id];
          const isUploading = Boolean(
            uploadItem &&
            (uploadItem.status === "uploading" ||
              uploadItem.status === "processing"),
          );
          const isCompleted = uploadItem?.status === "completed";
          const isError = uploadItem?.status === "error";
          const isTemp = asset._id.startsWith("temp_");
          const isExport =
            asset.type === "export" || activeFilterTab === "Exports";
          const canDownload =
            asset.original_url &&
            !asset.original_url.startsWith("blob:") &&
            !isUploading &&
            !isTemp;

          return (
            <div
              key={asset._id}
              draggable={!isUploading && !isTemp}
              onDragStart={(e) => {
                if (isUploading || isTemp) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify(asset),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => handleAddToTimeline(asset)}
              className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:border-sky-400 transition-all flex flex-col items-center h-auto self-start"
            >
              {/* Top Action Buttons: Download & Delete */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                {canDownload && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const filename =
                        asset.public_id || `video_${asset._id}.mp4`;
                      dispatch(
                        addToast({
                          type: "info",
                          message: `Downloading "${filename}"...`,
                        }),
                      );
                      await downloadMediaFile(asset.original_url, filename);
                    }}
                    className="bg-sky-500 text-white p-1 rounded-md hover:bg-sky-600 shadow-xs cursor-pointer"
                    title="Download Video File"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={(e) => handleDeleteClick(e, asset)}
                  className="bg-red-500/90 text-white p-1 rounded-md hover:bg-red-600 shadow-xs cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div className="w-full h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden shrink-0">
                {/* Loading Overlay while video is uploading */}
                {(isUploading || (isTemp && !isCompleted && !isError)) && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center select-none">
                    <Loader2 className="w-5 h-5 text-sky-400 animate-spin mb-1" />
                    <span className="text-[10px] font-bold text-white leading-tight">
                      {uploadItem?.status === "processing"
                        ? "Processing..."
                        : `Uploading ${uploadItem?.progress ?? 0}%`}
                    </span>
                    <div className="w-4/5 bg-slate-700/80 rounded-full h-1 mt-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-200 rounded-full"
                        style={{
                          width: `${Math.max(8, uploadItem?.progress ?? 5)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {isCompleted && (
                  <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center text-white">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                    <span className="text-[10px] font-bold text-emerald-200">
                      Uploaded!
                    </span>
                  </div>
                )}

                {isError && (
                  <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center text-white">
                    <AlertCircle className="w-5 h-5 text-rose-400 mb-0.5" />
                    <span className="text-[10px] font-bold text-rose-200">
                      Upload Failed
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(removeOptimisticAsset(asset._id));
                      }}
                      className="mt-1 text-[9px] underline text-rose-300 hover:text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {asset.type === "video" || asset.type === "export" ? (
                  <>
                    <video
                      src={
                        mediaManager.getCachedBlobUrlSync(
                          asset._id,
                          getMediaUrl(asset.preview_url || asset.original_url),
                        ) ||
                        getMediaUrl(asset.preview_url || asset.original_url)
                      }
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow-md">
                        <Play className="w-3.5 h-3.5 fill-slate-800 ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : asset.type === "audio" ? (
                  /* Soundwave Bars visualizer */
                  <div className="flex items-center gap-1 h-10">
                    <span className="w-1 h-5 bg-sky-500 rounded-full animate-pulse" />
                    <span className="w-1 h-8 bg-sky-400 rounded-full animate-pulse" />
                    <span className="w-1 h-3 bg-sky-500 rounded-full" />
                    <span className="w-1 h-7 bg-sky-400 rounded-full animate-pulse" />
                    <span className="w-1 h-4 bg-sky-500 rounded-full" />
                  </div>
                ) : asset.type === "image" ? (
                  <img
                    src={getMediaUrl(asset.preview_url || asset.original_url)}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                    {asset.content || "Text"}
                  </div>
                )}
              </div>

              <div className="p-2 w-full text-center shrink-0">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate block">
                  {asset.public_id ||
                    asset.original_url.split("/").pop() ||
                    "Media"}
                </span>

                {/* Prominent Download button for Exported Videos */}
                {isExport && canDownload && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const filename =
                        asset.public_id || `export_${Date.now()}.mp4`;
                      dispatch(
                        addToast({
                          type: "info",
                          message: `Downloading export "${filename}"...`,
                        }),
                      );
                      await downloadMediaFile(asset.original_url, filename);
                    }}
                    className="mt-1.5 w-full py-1 px-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    title="Download Exported Video"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredAssets.length === 0 && (
          <div className="col-span-2 text-center py-10 text-xs text-slate-400">
            No resources uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;
