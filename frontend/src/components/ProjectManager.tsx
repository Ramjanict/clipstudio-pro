import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadProject, createProject, triggerAutosave } from "@/store/thunks";
import { setProjectManagerOpen } from "@/store/uiSlice";
import { addToast } from "@/store/uiSlice";
import { api } from "@/lib/api";
import { FolderOpen, Plus, Trash2, Clock, X } from "lucide-react";
import type { Project } from "@/types";

export function ProjectManager() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.ui.isProjectManagerOpen);
  const activeProjectId = useAppSelector((s) => s.editor.activeProjectId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchProjects();
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get<Project[]>("/projects");
      setProjects(res.data);
    } catch {
      dispatch(addToast({ type: "error", message: "Failed to load projects" }));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (projectId: string) => {
    dispatch(triggerAutosave());
    await dispatch(loadProject(projectId));
    dispatch(setProjectManagerOpen(false));
    dispatch(addToast({ type: "success", message: "Project loaded!" }));
  };

  const handleNew = async () => {
    const name = prompt("Project name:", "New Project");
    if (!name) return;
    dispatch(triggerAutosave());
    await dispatch(createProject(name));
    dispatch(setProjectManagerOpen(false));
    dispatch(addToast({ type: "success", message: `Created "${name}"` }));
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${projectId}`);
      dispatch(addToast({ type: "success", message: `Deleted "${title}"` }));
      fetchProjects();
    } catch {
      dispatch(addToast({ type: "error", message: "Failed to delete project" }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <FolderOpen className="w-4 h-4 text-blue-500" />
            Project Manager
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
            <button onClick={() => dispatch(setProjectManagerOpen(false))} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-[420px] overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="text-center py-8 text-slate-500 text-xs">Loading projects...</div>
          )}
          {!loading && projects.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs italic">No projects yet. Create one to get started.</div>
          )}
          {projects.map((project) => {
            const isActive = project._id === activeProjectId;
            return (
              <button
                key={project._id}
                onClick={() => handleOpen(project._id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer group ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500/50 text-blue-900 dark:text-white"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">{project.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{project.duration?.toFixed(1) || "0.0"}s</span>
                    <span>•</span>
                    <span>{project.fps || 30} fps</span>
                    <span>•</span>
                    <span>{project.resolution?.w || 1920}x{project.resolution?.h || 1080}</span>
                  </div>
                </div>
                {isActive && <span className="text-[10px] text-blue-500 dark:text-blue-400 font-semibold shrink-0">ACTIVE</span>}
                {!isActive && (
                  <button
                    onClick={(e) => handleDelete(e, project._id, project.title)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
