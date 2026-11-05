import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ClusterStats } from '@/types';

export interface RenderTask {
  jobId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  duration: number;
  percent: number;
  status: 'rendering' | 'encoding' | 'uploading' | 'completed' | 'failed';
}

export interface WorkerState {
  isWorkerEnabled: boolean;
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'IDLE' | 'RENDERING';
  currentTask: RenderTask | null;
  segmentsCompleted: number;
  clusterStats: ClusterStats;
  logMessages: string[];
}

const initialEnabled = typeof window !== 'undefined' ? localStorage.getItem('worker_opt_in') !== 'false' : true;
const initialCompleted = typeof window !== 'undefined' ? parseInt(localStorage.getItem('worker_completed_count') || '0', 10) : 0;

const initialState: WorkerState = {
  isWorkerEnabled: initialEnabled,
  connectionStatus: 'DISCONNECTED',
  currentTask: null,
  segmentsCompleted: initialCompleted,
  clusterStats: {
    totalWorkers: 0,
    idleWorkers: 0,
    busyWorkers: 0,
    totalSegmentsRendered: 0,
  },
  logMessages: [],
};

const workerSlice = createSlice({
  name: 'worker',
  initialState,
  reducers: {
    setWorkerEnabled(state, action: PayloadAction<boolean>) {
      state.isWorkerEnabled = action.payload;
      localStorage.setItem('worker_opt_in', String(action.payload));
      if (!action.payload) {
        state.connectionStatus = 'DISCONNECTED';
        state.currentTask = null;
      }
    },
    setConnectionStatus(state, action: PayloadAction<WorkerState['connectionStatus']>) {
      state.connectionStatus = action.payload;
    },
    setCurrentTask(state, action: PayloadAction<RenderTask | null>) {
      state.currentTask = action.payload;
    },
    updateTaskProgress(state, action: PayloadAction<{ percent: number; status?: RenderTask['status'] }>) {
      if (state.currentTask) {
        state.currentTask.percent = action.payload.percent;
        if (action.payload.status) {
          state.currentTask.status = action.payload.status;
        }
      }
    },
    completeCurrentTask(state) {
      state.segmentsCompleted += 1;
      localStorage.setItem('worker_completed_count', String(state.segmentsCompleted));
      state.currentTask = null;
      state.connectionStatus = 'IDLE';
    },
    setClusterStats(state, action: PayloadAction<ClusterStats>) {
      state.clusterStats = action.payload;
    },
    addWorkerLog(state, action: PayloadAction<string>) {
      state.logMessages.unshift(`[${new Date().toLocaleTimeString()}] ${action.payload}`);
      if (state.logMessages.length > 20) {
        state.logMessages.pop();
      }
    },
  },
});

export const {
  setWorkerEnabled,
  setConnectionStatus,
  setCurrentTask,
  updateTaskProgress,
  completeCurrentTask,
  setClusterStats,
  addWorkerLog,
} = workerSlice.actions;

export default workerSlice.reducer;
