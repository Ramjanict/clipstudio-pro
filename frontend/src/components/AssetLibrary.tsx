import { mediaManager } from "@/services/mediaManager";
import { addAssetToTimeline, addOptimisticAsset } from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteAsset, triggerAutosave, uploadAsset } from "@/store/thunks";
import { addToast } from "@/store/uiSlice";
import type { Asset } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import DeleteWarning from "./assetLibrary/DeleteWarning";
import Elements from "./assetLibrary/Elements";
import LeftVertical from "./assetLibrary/LeftVertical";
import Live from "./assetLibrary/Live";
import UploadSection from "./assetLibrary/UploadSection";
export type ActiveRailTab = "upload" | "elements" | "live";
export type ActiveFilterTab = "All" | "Image" | "Video" | "Audio" | "Exports";
export interface AssetLibraryProps {
  activeRailTab?: ActiveRailTab;
  onRailTabChange?: (tab: ActiveRailTab) => void;
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({
  activeRailTab: propsRailTab,
  onRailTabChange,
}) => {
  const dispatch = useAppDispatch();
  const { assets, uploadingAssets } = useAppSelector((state) => state.editor);

  const activeUploadsList = Object.values(uploadingAssets);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalRailTab, setInternalRailTab] =
    useState<ActiveRailTab>("upload");
  const activeRailTab = propsRailTab ?? internalRailTab;

  const handleRailClick = (tab: ActiveRailTab) => {
    setInternalRailTab(tab);
    if (onRailTabChange) onRailTabChange(tab);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilterTab, setActiveFilterTab] =
    useState<ActiveFilterTab>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRailUploadClick = () => {
    setInternalRailTab("upload");
    if (onRailTabChange) onRailTabChange("upload");
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of files) {
      const localBlobUrl = URL.createObjectURL(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      let type: "video" | "image" | "audio" = "video";
      if (
        file.type.startsWith("image/") ||
        ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext)
      ) {
        type = "image";
      } else if (
        file.type.startsWith("audio/") ||
        ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)
      ) {
        type = "audio";
      }

      let duration = 10;
      if (type === "image") {
        duration = 5;
      } else {
        try {
          const media = document.createElement(
            type === "audio" ? "audio" : "video",
          );
          media.preload = "metadata";
          media.src = localBlobUrl;
          await new Promise((res) => {
            media.onloadedmetadata = () => res(null);
            media.onerror = () => res(null);
            setTimeout(res, 1000);
          });
          if (media.duration && !isNaN(media.duration) && media.duration > 0) {
            duration = media.duration;
          }
        } catch {
          duration = 10;
        }
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      mediaManager.registerLocalBlob(tempId, file);

      const optimisticAsset: Asset = {
        _id: tempId,
        original_url: localBlobUrl,
        preview_url: localBlobUrl,
        duration: duration,
        type: type,
        public_id: file.name,
      };

      // 1. Instantly display asset in library (0ms UI latency!)
      dispatch(addOptimisticAsset(optimisticAsset));

      // 2. Auto-switch filter tab so user sees asset immediately
      const cap = type.charAt(0).toUpperCase() + type.slice(1);
      if (["Image", "Video", "Audio"].includes(cap)) {
        setActiveFilterTab(cap as any);
      } else {
        setActiveFilterTab("All");
      }

      // 3. Background async upload to live server
      dispatch(uploadAsset({ file, tempId }));
    }
  };

  const handleAddToTimeline = (asset: Asset) => {
    const uploadItem = uploadingAssets[asset._id];
    if (
      uploadItem &&
      (uploadItem.status === "uploading" || uploadItem.status === "processing")
    ) {
      dispatch(
        addToast({
          type: "info",
          message: `"${asset.public_id || "Video"}" is uploading in background (${uploadItem.progress}%). It will be saved automatically.`,
        }),
      );
    }
    dispatch(addAssetToTimeline({ asset }));
    dispatch(triggerAutosave());
  };

  const handleDeleteClick = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      const filename = assetToDelete.public_id || "Media file";
      await dispatch(deleteAsset(assetToDelete._id)).unwrap();
      dispatch(
        addToast({
          type: "success",
          message: `Successfully deleted "${filename}".`,
        }),
      );
    } catch (err) {
      console.error("Delete failed:", err);
      dispatch(
        addToast({
          type: "error",
          message: "Failed to delete file from server.",
        }),
      );
    } finally {
      setIsDeleting(false);
      setAssetToDelete(null);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesFilter =
      activeFilterTab === "All"
        ? true
        : activeFilterTab === "Exports"
          ? asset.type.toLowerCase() === "export"
          : asset.type.toLowerCase() === activeFilterTab.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (asset.public_id || asset.original_url)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleAddText = () => {
    const textAsset: Asset = {
      _id: `text_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "text",
      content: "Title Goes There",
      public_id: `Text Element`,
    };
    dispatch(addAssetToTimeline({ asset: textAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddQR = () => {
    const qrAsset: Asset = {
      _id: `qr_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "qr",
      content: "https://example.com",
      public_id: `QR Code`,
    };
    dispatch(addAssetToTimeline({ asset: qrAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddSlider = () => {
    const sliderAsset: Asset = {
      _id: `slider_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "slider",
      content: "Slider Widget",
      public_id: `Slider Widget`,
    };
    dispatch(addAssetToTimeline({ asset: sliderAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddShape = (shapeName: string) => {
    const shapeAsset: Asset = {
      _id: `shape_${shapeName}_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "shape",
      content: shapeName,
      public_id: `${shapeName} Shape`,
    };
    dispatch(addAssetToTimeline({ asset: shapeAsset }));
    dispatch(triggerAutosave());
  };

  return (
    <div className="relative shrink-0 flex h-full z-20">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Asset Library" : "Collapse Asset Library"}
        className="absolute top-1/2 -translate-y-1/2 -right-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      <div
        className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex overflow-hidden ${
          isCollapsed
            ? "w-0 opacity-0 overflow-hidden border-r-0"
            : "w-80 opacity-100"
        }`}
      >
        <LeftVertical
          handleRailClick={handleRailClick}
          handleRailUploadClick={handleRailUploadClick}
          activeRailTab={activeRailTab}
        />

        <div className="w-64 flex flex-col h-full bg-white dark:bg-slate-950">
          {activeRailTab === "upload" && (
            <UploadSection
              fileInputRef={fileInputRef}
              handleUpload={handleUpload}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeFilterTab={activeFilterTab}
              setActiveFilterTab={setActiveFilterTab}
              activeUploadsList={activeUploadsList}
              filteredAssets={filteredAssets}
              handleAddToTimeline={handleAddToTimeline}
              handleDeleteClick={handleDeleteClick}
            />
          )}

          {activeRailTab === "elements" && (
            <Elements
              handleAddText={handleAddText}
              handleAddQR={handleAddQR}
              handleAddSlider={handleAddSlider}
              handleAddShape={handleAddShape}
            />
          )}

          {activeRailTab === "live" && <Live />}
        </div>
      </div>

      {assetToDelete &&
        typeof document !== "undefined" &&
        createPortal(
          <DeleteWarning
            isDeleting={isDeleting}
            setAssetToDelete={setAssetToDelete}
            assetToDelete={assetToDelete}
            handleConfirmDelete={handleConfirmDelete}
          />,
          document.body,
        )}
    </div>
  );
};

export default AssetLibrary;
