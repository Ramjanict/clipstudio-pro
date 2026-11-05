import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setExportModePreference, closeExportModal } from '@/store/editorSlice';
import { exportVideo } from '@/store/thunks';
import { addToast } from '@/store/uiSlice';
import { X, Download, CheckCircle2, Zap, Loader2, ExternalLink, Cpu, Server, Play, Film } from 'lucide-react';
import { getMediaUrl } from '@/lib/api';
import { downloadMediaFile } from '@/lib/utils';
import { estimateRenderTimeSec, detectCapabilities } from '@/services/browserCapabilities';
import { cancelCurrentBrowserExport } from '@/services/browserExportEngine';

export function ExportModal() {
  const dispatch = useAppDispatch();

  const handleClose = () => {
    cancelCurrentBrowserExport();
    dispatch(closeExportModal());
  };
  const {
    isExportModalOpen,
    isExporting,
    exportProgress,
    exportUrl,
    exportEta,
    exportStatus,
    exportModePreference,
    sceneGraph,
  } = useAppSelector((state) => state.editor);

  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<'browser' | 'server'>('server');
  const [estimatedSec, setEstimatedSec] = useState<number | null>(null);

  // Pre-flight calculation: estimate render workload & pre-select recommended target
  useEffect(() => {
    if (isExportModalOpen && sceneGraph && !isExporting) {
      detectCapabilities().then((caps) => {
        const estSec = estimateRenderTimeSec(sceneGraph, caps);
        setEstimatedSec(estSec);
        // Pre-select recommended target (> 7 min = server, < 7 min = browser)
        const recommended = estSec >= 420 ? 'server' : 'browser';
        setSelectedTarget(recommended);
        dispatch(setExportModePreference(recommended));
      });
    }
  }, [isExportModalOpen, sceneGraph]);

  const getFilenameFromUrl = (url?: string | null): string => {
    if (!url || typeof url !== 'string') return `export_${Date.now()}.mp4`;
    const cleanUrl = url.split('?')[0] || '';
    const parts = cleanUrl.split('/uploads/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.trim().length > 0) {
      return lastPart.split('/').pop() || lastPart;
    }
    const slashParts = cleanUrl.split('/');
    return slashParts[slashParts.length - 1] || `export_${Date.now()}.mp4`;
  };

  const formatEta = (totalSeconds: number): string => {
    const rounded = Math.max(0, Math.round(totalSeconds));
    if (rounded <= 0) return 'Almost done...';

    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
    }
    if (minutes > 0) {
      return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
    }
    return `${seconds} s`;
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!exportUrl || isDownloading) return;

    const filename = getFilenameFromUrl(exportUrl);
    setIsDownloading(true);
    dispatch(addToast({ type: 'info', message: `Starting download for "${filename}"...` }));

    try {
      await downloadMediaFile(exportUrl, filename);
      dispatch(addToast({ type: 'success', message: `Download initiated for "${filename}"!` }));
    } catch (err) {
      console.error('Download error:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to download file directly. Opening in new tab.' }));
      window.open(getMediaUrl(exportUrl), '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartRender = () => {
    dispatch(setExportModePreference(selectedTarget));
    dispatch(exportVideo({ mode: selectedTarget }));
  };

  // Automatically trigger download on export completion
  useEffect(() => {
    if (exportUrl && isExporting) {
      handleDownload();
    }
  }, [exportUrl]);

  if (!isExportModalOpen && !isExporting) return null;

  const durationSec = sceneGraph?.duration || 0;
  const fps = sceneGraph?.fps || 30;
  const totalFrames = Math.ceil(durationSec * fps);
  const isOverSevenMin = estimatedSec !== null ? estimatedSec >= 420 : durationSec >= 420;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col items-center relative overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Top close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500 dark:text-sky-400 mb-3 shadow-xs">
          {exportUrl ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
          ) : isExporting ? (
            <Zap className="w-6 h-6 text-sky-500 animate-pulse" />
          ) : (
            <Film className="w-6 h-6 text-sky-500" />
          )}
        </div>

        <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
          {exportUrl
            ? 'Export Masterpiece Complete!'
            : isExporting
            ? 'Exporting Video Project'
            : 'Export Video Settings'}
        </h2>

        {/* ────────────────────────────────────────────────────────────── */}
        {/* STEP 1: PRE-FLIGHT SELECTION MODAL (Render not started yet)     */}
        {/* ────────────────────────────────────────────────────────────── */}
        {!isExporting && !exportUrl ? (
          <div className="w-full flex flex-col items-center mt-2 text-xs">
            <p className="text-slate-500 dark:text-slate-400 text-center mb-4 leading-relaxed">
              Select your preferred render location target before starting rendering.
            </p>

            {/* Project Summary Card */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 mb-4 flex items-center justify-between font-mono">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase block">Duration</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatEta(durationSec)}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase block">Total Frames</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{totalFrames.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase block">Est. Workload</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">
                  {estimatedSec !== null ? formatEta(estimatedSec) : 'calculating...'}
                </span>
              </div>
            </div>

            {/* Render Target Selection Label */}
            <div className="w-full text-left font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Choose Render Engine Target:</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                {isOverSevenMin ? '⚠️ Over 7 min project' : '⚡ Under 7 min project'}
              </span>
            </div>

            {/* Target Options Cards (Server vs Browser) */}
            <div className="grid grid-cols-2 gap-2.5 w-full mb-5">
              {/* Option 1: Cloud Server Engine */}
              <button
                type="button"
                onClick={() => setSelectedTarget('server')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  selectedTarget === 'server'
                    ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {isOverSevenMin && (
                  <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-bl font-semibold uppercase">
                    Recommended
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <Server className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-bold text-xs">Cloud Server</span>
                </div>
                <p className="text-[10px] opacity-80 leading-normal">
                  Renders on server via FFmpeg. 0% CPU load on your PC.
                </p>
              </button>

              {/* Option 2: Local Browser Engine */}
              <button
                type="button"
                onClick={() => setSelectedTarget('browser')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  selectedTarget === 'browser'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {!isOverSevenMin && (
                  <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-bl font-semibold uppercase">
                    Recommended
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-bold text-xs">Local Browser</span>
                </div>
                <p className="text-[10px] opacity-80 leading-normal">
                  WebCodecs H.264 / WASM local render directly in browser.
                </p>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartRender}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-sky-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Render</span>
              </button>
            </div>
          </div>
        ) : exportUrl ? (
          /* ────────────────────────────────────────────────────────────── */
          /* STEP 3: EXPORT COMPLETE STATE                                  */
          /* ────────────────────────────────────────────────────────────── */
          <div className="flex flex-col items-center w-full mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4 leading-relaxed">
              Your video project was successfully composited and encoded.
            </p>

            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                {getFilenameFromUrl(exportUrl)}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                Ready
              </span>
            </div>

            {/* Main Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl w-full text-center transition-all shadow-md hover:shadow-sky-500/25 flex items-center justify-center gap-2 mb-2 cursor-pointer text-xs disabled:opacity-70"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download Video File
                </>
              )}
            </button>

            {/* Direct Open Link fallback */}
            <a
              href={getMediaUrl(exportUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mb-4 py-1"
            >
              <ExternalLink className="w-3 h-3" /> Open Video in New Tab
            </a>

            <button
              onClick={handleClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs py-1.5 transition-colors cursor-pointer"
            >
              Back to Studio Editor
            </button>
          </div>
        ) : (
          /* ────────────────────────────────────────────────────────────── */
          /* STEP 2: LIVE RENDERING PROGRESS STATE                          */
          /* ────────────────────────────────────────────────────────────── */
          <div className="w-full flex flex-col items-center mt-2 text-xs">
            {/* Active Engine Badge */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 mb-4 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Active Render Target:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                {exportModePreference === 'browser' ? (
                  <>
                    <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Local Browser Engine</span>
                  </>
                ) : (
                  <>
                    <Server className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Cloud Server Engine</span>
                  </>
                )}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-3 overflow-hidden relative border border-slate-200 dark:border-slate-700/60">
              <div
                className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full transition-all duration-300 relative rounded-full"
                style={{ width: `${Math.max(4, exportProgress)}%` }}
              >
                <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:16px_16px] animate-[move-stripes_1s_linear_infinite]" />
              </div>
            </div>

            <div className="flex justify-between w-full text-xs text-slate-700 dark:text-slate-300 font-medium mb-1 font-mono">
              <span>{Math.round(exportProgress)}% Completed</span>
              {exportEta !== null && (
                <span>Remaining time: {formatEta(exportEta)}</span>
              )}
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-[11px] text-center mb-6">
              {exportStatus || 'Orchestrating render pipeline...'}
            </p>

            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors cursor-pointer font-semibold"
            >
              Cancel Render
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportModal;

