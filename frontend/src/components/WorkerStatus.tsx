import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setWorkerEnabled } from '@/store/workerSlice';
import { Cpu, Zap, Activity, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react';

export function WorkerStatus() {
  const dispatch = useAppDispatch();
  const {
    isWorkerEnabled,
    connectionStatus,
    currentTask,
    segmentsCompleted,
    clusterStats,
    logMessages,
  } = useAppSelector((state) => state.worker);

  const [isOpen, setIsOpen] = useState(false);

  const isRendering = connectionStatus === 'RENDERING';
  const isConnected = connectionStatus === 'IDLE' || connectionStatus === 'RENDERING';

  return (
    <div className="relative">
      {/* Telemetry Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer ${
          isRendering
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse'
            : isConnected && isWorkerEnabled
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
        }`}
        title="Distributed Rendering Cluster Telemetry"
      >
        <span className="relative flex h-2 w-2">
          {isConnected && isWorkerEnabled && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isRendering ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isRendering
                ? 'bg-amber-500'
                : isConnected && isWorkerEnabled
                ? 'bg-emerald-500'
                : 'bg-slate-500'
            }`}
          />
        </span>

        <Zap className="w-3.5 h-3.5" />
        <span className="font-medium hidden sm:inline">
          {isRendering
            ? `Rendering Segment (${currentTask?.percent || 0}%)`
            : isWorkerEnabled
            ? `Cluster: ${Math.max(1, clusterStats.totalWorkers)} Nodes Active`
            : 'Distributed Worker Disabled'}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Popover Details Modal */}
      {isOpen && (
        <div className="absolute right-0 top-9 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl p-4 z-50 text-slate-800 dark:text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Cpu className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Distributed Render Node</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono">
              v1.0 Distributed
            </span>
          </div>

          {/* Toggle worker participation */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 mb-3">
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Contribute Idle CPU</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Share background render power</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isWorkerEnabled}
                onChange={(e) => dispatch(setWorkerEnabled(e.target.checked))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Cluster Telemetry */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/40">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Online Workers</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {Math.max(1, clusterStats.totalWorkers)} Nodes
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/40">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Your Contributions</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {segmentsCompleted} Segments
              </div>
            </div>
          </div>

          {/* Active Job status if rendering */}
          {currentTask && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg mb-3">
              <div className="flex justify-between text-[11px] text-amber-700 dark:text-amber-300 mb-1 font-medium">
                <span>Rendering Segment #{currentTask.segmentIndex}</span>
                <span>{currentTask.percent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 dark:bg-amber-400 h-full transition-all duration-200"
                  style={{ width: `${currentTask.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Logs */}
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Live Node Telemetry
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 h-24 overflow-y-auto space-y-1">
              {logMessages.length > 0 ? (
                logMessages.map((msg, idx) => (
                  <div key={idx} className="truncate">
                    {msg}
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-slate-600 italic">Waiting for distributed jobs...</div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-blue-500 dark:text-blue-400" />
            <span>Encrypted WebAssembly sandbox execution</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerStatus;
