import { Download, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import AssetLibrary from "./components/AssetLibrary";
import VideoStudio from "./components/auth/VideoStudio";
import { AuthModal } from "./components/AuthModal";
import AdminButton from "./components/editor/AdminButton";
import EditorHeaderTemplate from "./components/editor/EditorHeaderTemplate";
import HistoryControls from "./components/editor/HistoryControls";
import ThemeToggle from "./components/editor/ThemeToggle";
import UploadProgress from "./components/editor/UploadProgress";
import UserDropdown from "./components/editor/UserDropdown";
import ZoomControl from "./components/editor/ZoomControl";
import { ExportModal } from "./components/ExportModal";
import { Player } from "./components/Player";
import { PreviewModal } from "./components/PreviewModal";
import { ProjectManager } from "./components/ProjectManager";
import { PropertiesPanel } from "./components/PropertiesPanel";
import ActionButton from "./components/shared/ActionButton";
import DarkButton from "./components/shared/DarkButton";
import { Timeline } from "./components/Timeline";
import { Toast } from "./components/Toast";
import { WorkerStatus } from "./components/WorkerStatus";
import { downloadMediaFile } from "./lib/utils";
import { renderWorker } from "./services/renderWorker";
import { fetchCurrentUser } from "./store/authSlice";
import { openExportModal, redo, undo } from "./store/editorSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { createProject, loadAssets, triggerAutosave } from "./store/thunks";
import {
  addToast,
  toggleAdminPanel,
  toggleProjectManager,
} from "./store/uiSlice";

const App = () => {
  const dispatch = useAppDispatch();
  const {
    activeProjectId,
    sceneGraph,
    past,
    future,
    exportUrl,
    uploadingAssets,
  } = useAppSelector((state) => state.editor);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const activeUploads = Object.values(uploadingAssets || {});
  const isUploadingMedia = activeUploads.some(
    (u) => u.status === "uploading" || u.status === "processing",
  );
  const uploadPercent =
    activeUploads.length > 0 ? activeUploads[0].progress : 0;

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });
  const [zoomPercent, setZoomPercent] = useState(60);
  const [projectTitle, setProjectTitle] = useState("Template 2025-08-29");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Initial sync on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      dispatch(fetchCurrentUser());
    }
    renderWorker.init();
    return () => {
      renderWorker.destroy();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      dispatch(loadAssets());
      if (!activeProjectId) {
        dispatch(createProject(undefined));
      }
    }
  }, [dispatch, isAuthenticated, user?.id, activeProjectId]);

  useEffect(() => {
    if (!sceneGraph || !activeProjectId) return;
    const interval = setInterval(() => {
      dispatch(triggerAutosave());
    }, 30000);
    return () => clearInterval(interval);
  }, [dispatch, sceneGraph, activeProjectId]);

  const handleExport = () => {
    if (isUploadingMedia) {
      dispatch(
        addToast({
          type: "warning",
          message:
            "Please wait until your video finishes uploading before exporting.",
        }),
      );
      return;
    }
    if (!sceneGraph || sceneGraph.tracks.every((t) => t.clips.length === 0)) {
      dispatch(
        addToast({
          type: "warning",
          message: "Add some clips to the timeline before exporting.",
        }),
      );
      return;
    }
    dispatch(openExportModal());
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleZoomIn = () => setZoomPercent((prev) => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoomPercent((prev) => Math.max(20, prev - 10));

  const getUserInitial = (
    u?: { firstName?: string; email?: string } | null,
  ) => {
    if (!u) return "U";
    if (typeof u.firstName === "string" && u.firstName.trim().length > 0) {
      return u.firstName.trim().charAt(0).toUpperCase();
    }
    if (typeof u.email === "string" && u.email.trim().length > 0) {
      return u.email.trim().charAt(0).toUpperCase();
    }
    return "U";
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const isAdminOrSuperAdmin =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}
    >
      <ExportModal />
      <AuthModal />
      <ProjectManager />
      <AdminPanel />
      <Toast />
      {isPreviewOpen && (
        <PreviewModal onClose={() => setIsPreviewOpen(false)} />
      )}

      {!isAuthenticated ? (
        <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative">
          <DarkButton isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
          <VideoStudio />
        </div>
      ) : (
        <>
          <header className="h-14 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30 shadow-xs">
            <EditorHeaderTemplate
              title={projectTitle}
              onBack={() => dispatch(toggleProjectManager())}
              onTitleChange={setProjectTitle}
            />
            <div className="flex items-center gap-4">
              {isAdminOrSuperAdmin && <WorkerStatus />}
              <ZoomControl
                zoomPercent={zoomPercent}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />
              <HistoryControls
                onUndo={() => {
                  dispatch(undo());
                  dispatch(triggerAutosave());
                }}
                onRedo={() => {
                  dispatch(redo());
                  dispatch(triggerAutosave());
                }}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>

            <div className="flex items-center gap-3">
              {isAdminOrSuperAdmin && (
                <AdminButton onClick={() => dispatch(toggleAdminPanel())} />
              )}

              {isUploadingMedia && (
                <UploadProgress uploadPercent={uploadPercent} />
              )}

              {exportUrl && (
                <ActionButton
                  onClick={async () => {
                    const filename =
                      exportUrl.split("/").pop()?.split("?")[0] ||
                      `export_${Date.now()}.mp4`;
                    dispatch(
                      addToast({
                        type: "info",
                        message: `Downloading "${filename}"...`,
                      }),
                    );
                    await downloadMediaFile(exportUrl, filename);
                  }}
                  title="Export Video"
                  label="Export Video"
                  icon={Download}
                />
              )}

              <ActionButton
                onClick={() => setIsPreviewOpen(true)}
                title="Full Project Preview (P)"
                label="Preview"
                icon={Eye}
                variant="outline"
                color="sky"
              />

              <ActionButton
                onClick={handleExport}
                title="Export Video"
                label="Export Video"
                icon={Download}
              />

              <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
              {user && (
                <UserDropdown user={user} getUserInitial={getUserInitial} />
              )}
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <AssetLibrary />

            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex-1 flex items-center justify-center relative min-h-[300px] overflow-hidden">
                <Player
                  zoomScale={zoomPercent / 100}
                  onOpenPreview={() => setIsPreviewOpen(true)}
                />
              </div>
              <div className="h-[280px] shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <Timeline />
              </div>
            </div>

            <PropertiesPanel />
          </div>
        </>
      )}
    </div>
  );
};

export default App;
