import {
  deleteClip,
  duplicateClip,
  separateAudio,
  setSelectedClip,
  updateClip,
} from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import type {
  AnimationProps,
  Clip,
  QrStyles,
  ShapeStyles,
  SliderStyles,
  TextStyles,
  TransformProps,
} from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Move,
  Music,
  Plus,
  QrCode as QrIcon,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { AnimationModal } from "./AnimationModal";
import { SelectLayoutModal } from "./SelectLayoutModal";

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const { selectedClipId, sceneGraph } = useAppSelector((s) => s.editor);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAnimationModalOpen, setIsAnimationModalOpen] = useState(false);
  const [currentLayout, setCurrentLayout] = useState("2:1 Horizontal");

  let selectedClip: Clip | null = null;
  let selectedTrackId = "";
  if (sceneGraph && selectedClipId) {
    for (const track of sceneGraph.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        selectedClip = clip;
        selectedTrackId = track.id;
        break;
      }
    }
  }

  // Local sync state
  const transform = selectedClip?.transform || {};
  const textStyles = selectedClip?.textStyles || {};
  const shapeStyles = selectedClip?.shapeStyles || {};
  const qrStyles = selectedClip?.qrStyles || {};
  const sliderStyles = selectedClip?.sliderStyles || {};
  const animation = selectedClip?.animation || {};

  const handleUpdateTransform = (updates: Partial<TransformProps>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newTransform = { ...(selectedClip.transform || {}), ...updates };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { transform: newTransform },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateTextStyles = (updates: Partial<TextStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.textStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.content ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { textStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateShapeStyles = (updates: Partial<ShapeStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.shapeStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.shapeType ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { shapeStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateQrStyles = (updates: Partial<QrStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.qrStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.qrContent ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { qrStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateSliderStyles = (updates: Partial<SliderStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.sliderStyles || {}), ...updates };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { sliderStyles: newStyles },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateAnimation = (animType: any) => {
    if (!selectedClip || !selectedTrackId) return;
    const newAnim: AnimationProps = { type: animType, duration: 0.6 };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { animation: newAnim },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleVolumeChange = (newVolume: number) => {
    if (selectedClip && selectedTrackId) {
      dispatch(
        updateClip({
          trackId: selectedTrackId,
          clipId: selectedClip.id,
          updates: { volume: newVolume, muted: newVolume === 0 },
        }),
      );
      dispatch(triggerAutosave());
    }
  };

  const handleDuplicate = () => {
    if (!selectedClip) return;
    dispatch(duplicateClip(selectedClip.id));
    dispatch(triggerAutosave());
  };

  const handleDelete = () => {
    if (!selectedClip) return;
    dispatch(deleteClip(selectedClip.id));
    dispatch(setSelectedClip(null));
    dispatch(triggerAutosave());
  };

  const handleShiftRight = () => {
    if (!selectedClip || !selectedTrackId) return;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: selectedClip.startTime + 1,
          endTime: selectedClip.endTime + 1,
        },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleShiftLeft = () => {
    if (!selectedClip || !selectedTrackId) return;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: Math.max(0, selectedClip.startTime - 1),
          endTime: Math.max(1, selectedClip.endTime - 1),
        },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleSeparateSound = () => {
    if (!selectedClip) return;
    dispatch(separateAudio({ clipId: selectedClip.id }));
    dispatch(triggerAutosave());
  };

  if (!selectedClip) {
    return (
      <div className="relative shrink-0 flex h-full z-20">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={
            isCollapsed
              ? "Expand Properties Panel"
              : "Collapse Properties Panel"
          }
          className="absolute top-1/2 -translate-y-1/2 -left-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
        >
          {isCollapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <div
          className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex flex-col overflow-y-auto ${
            isCollapsed
              ? "w-0 opacity-0 overflow-hidden border-l-0"
              : "w-80 opacity-100 p-4"
          }`}
        >
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Canvas Properties
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select any element on canvas or timeline to customize properties.
            </p>
          </div>

          <div className="pt-4 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Aspect Ratio</span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                16:9 Widescreen (960 x 540)
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">
                Timeline Duration
              </span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono font-semibold text-slate-700 dark:text-slate-200">
                {(sceneGraph?.duration ?? 0).toFixed(1)}s
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Active Tracks</span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                {sceneGraph?.tracks.length || 0} Tracks Active
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clipType = selectedClip.asset?.type || "video";
  const contentName =
    selectedClip.asset?.content || selectedClip.asset?.public_id || "Element";

  return (
    <div className="relative shrink-0 flex h-full z-20">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={
          isCollapsed ? "Expand Properties Panel" : "Collapse Properties Panel"
        }
        className="absolute top-1/2 -translate-y-1/2 -left-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
      >
        {isCollapsed ? (
          <ChevronLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      <div
        className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex flex-col overflow-y-auto ${
          isCollapsed
            ? "w-0 opacity-0 overflow-hidden border-l-0"
            : "w-80 opacity-100"
        }`}
      >
        {/* 1. Header Title */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {clipType === "text" && (
              <Type className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "qr" && (
              <QrIcon className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "shape" && (
              <Square className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "slider" && (
              <SlidersHorizontal className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
              {contentName}
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 uppercase font-bold tracking-wider">
            {clipType}
          </span>
        </div>

        {/* 2. Quick Action Toolbar Grid */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-5 gap-1.5">
          <button
            onClick={handleDuplicate}
            title="Duplicate Element"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {clipType === "video" && (
            <button
              onClick={handleSeparateSound}
              title="Separate Sound"
              className="flex items-center justify-center p-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleShiftLeft}
            title="Shift Left (1s)"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleShiftRight}
            title="Shift Right (1s)"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            title="Delete Element"
            className="flex items-center justify-center p-2 rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Form Inspectors */}
        <div className="p-4 space-y-5 flex-1">
          {/* A. TEXT INSPECTOR */}
          {clipType === "text" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Text Content
                </label>
                <textarea
                  rows={2}
                  value={
                    textStyles.content ??
                    selectedClip.asset?.content ??
                    "Title Goes There"
                  }
                  onChange={(e) =>
                    handleUpdateTextStyles({ content: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Text Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={textStyles.color || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateTextStyles({ color: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={textStyles.color || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateTextStyles({ color: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Background
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={textStyles.backgroundColor || ""}
                      placeholder="None"
                      onChange={(e) =>
                        handleUpdateTextStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={textStyles.backgroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateTextStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Font Family
                  </label>
                  <select
                    value={textStyles.fontFamily || "Inter"}
                    onChange={(e) =>
                      handleUpdateTextStyles({ fontFamily: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Arial">Arial</option>
                    <option value="Impact">Impact</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Font Weight
                  </label>
                  <select
                    value={textStyles.fontWeight || "Bold"}
                    onChange={(e) =>
                      handleUpdateTextStyles({ fontWeight: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Medium">Medium</option>
                    <option value="SemiBold">SemiBold</option>
                    <option value="Bold">Bold</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Font Size</span>
                  <span>{textStyles.fontSize || 36}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={120}
                  value={textStyles.fontSize || 36}
                  onChange={(e) =>
                    handleUpdateTextStyles({
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* B. QR CODE INSPECTOR */}
          {clipType === "qr" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  QR Target URL / Text
                </label>
                <input
                  type="text"
                  value={
                    qrStyles.qrContent ||
                    selectedClip.asset?.content ||
                    "https://example.com"
                  }
                  onChange={(e) =>
                    handleUpdateQrStyles({ qrContent: e.target.value })
                  }
                  placeholder="https://mysite.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    QR Modules Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={qrStyles.foregroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          foregroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={qrStyles.foregroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          foregroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Background
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={qrStyles.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={qrStyles.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. SHAPE INSPECTOR */}
          {clipType === "shape" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shape Type
                </label>
                <select
                  value={
                    shapeStyles.shapeType ||
                    (selectedClip.asset?.content as any) ||
                    "Rectangle"
                  }
                  onChange={(e) =>
                    handleUpdateShapeStyles({
                      shapeType: e.target.value as any,
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Rectangle">Rectangle</option>
                  <option value="Ellipses">Ellipse / Circle</option>
                  <option value="Triangle">Triangle</option>
                  <option value="Star">Star</option>
                  <option value="Line">Line</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fill Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={shapeStyles.fillColor || "#38bdf8"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ fillColor: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={shapeStyles.fillColor || "#38bdf8"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ fillColor: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Stroke Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={shapeStyles.strokeColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ strokeColor: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={shapeStyles.strokeColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ strokeColor: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Stroke / Line Thickness</span>
                  <span>
                    {shapeStyles.strokeWidth ??
                      (shapeStyles.shapeType === "line" ||
                      (shapeStyles.shapeType as any) === "Line"
                        ? 4
                        : 0)}
                    px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={
                    shapeStyles.strokeWidth ??
                    (shapeStyles.shapeType === "line" ||
                    (shapeStyles.shapeType as any) === "Line"
                      ? 4
                      : 0)
                  }
                  onChange={(e) =>
                    handleUpdateShapeStyles({
                      strokeWidth: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* D. SLIDER INSPECTOR */}
          {clipType === "slider" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Slide Transition
                </label>
                <select
                  value={sliderStyles.transition || "fade"}
                  onChange={(e) =>
                    handleUpdateSliderStyles({
                      transition: e.target.value as any,
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="fade">Cross Fade</option>
                  <option value="left">Slide Left</option>
                  <option value="right">Slide Right</option>
                  <option value="zoom">Zoom</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Slide Duration</span>
                  <span>{sliderStyles.slideDuration || 2.5}s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={sliderStyles.slideDuration || 2.5}
                  onChange={(e) =>
                    handleUpdateSliderStyles({
                      slideDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* D. TRANSFORM / POSITION & SCALE INSPECTOR (All visual clips) */}
          {clipType !== "audio" && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-sky-500" /> Transform &
                Position
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">Position X</span>
                  <input
                    type="number"
                    value={transform.x ?? 0}
                    onChange={(e) =>
                      handleUpdateTransform({
                        x: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">Position Y</span>
                  <input
                    type="number"
                    value={transform.y ?? 0}
                    onChange={(e) =>
                      handleUpdateTransform({
                        y: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Scale</span>
                  <span>{Math.round((transform.scale ?? 1.0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={transform.scale ?? 1.0}
                  onChange={(e) =>
                    handleUpdateTransform({ scale: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Rotation</span>
                  <span>{transform.rotation ?? 0}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={transform.rotation ?? 0}
                  onChange={(e) =>
                    handleUpdateTransform({
                      rotation: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* E. AUDIO / VIDEO VOLUME CONTROLS */}
          {(clipType === "video" || clipType === "audio") && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-sky-500" /> Volume
                </span>
                <span>
                  {selectedClip.volume !== undefined
                    ? selectedClip.volume
                    : 100}
                  %
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={
                  selectedClip.volume !== undefined ? selectedClip.volume : 100
                }
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
          )}

          {/* F. ANIMATION PICKER */}
          {clipType !== "audio" && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Animation:{" "}
                <span className="capitalize font-normal text-slate-400">
                  {animation.type || "None"}
                </span>
              </span>
              <button
                onClick={() => setIsAnimationModalOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Choose</span>
              </button>
            </div>
          )}
        </div>

        {/* Modals */}
        <SelectLayoutModal
          isOpen={isLayoutModalOpen}
          onClose={() => setIsLayoutModalOpen(false)}
          onSelectLayout={(layoutId) => setCurrentLayout(layoutId)}
          currentLayout={currentLayout}
        />

        <AnimationModal
          isOpen={isAnimationModalOpen}
          onClose={() => setIsAnimationModalOpen(false)}
          onSelectAnimation={(anim) => handleUpdateAnimation(anim.type)}
          currentAnimation={animation.type}
        />
      </div>
    </div>
  );
}

export default PropertiesPanel;
