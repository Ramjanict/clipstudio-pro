import { createAsyncThunk } from '@reduxjs/toolkit';
import { api, API_BASE } from '@/lib/api';
import {
  setAssets,
  replaceOptimisticAsset,
  removeOptimisticAsset,
  setUploadProgress,
  removeUploadProgress,
  setProject,
  setExportProgressDetails,
  setExporting,
  setExportUrl,
} from './editorSlice';
import { addToast } from './uiSlice';
import type { RootState } from './index';
import { canRenderInBrowser, exportInBrowser, cancelCurrentBrowserExport } from '@/services/browserExportEngine';

export { API_BASE };

export const loadAssets = createAsyncThunk(
  'editor/loadAssets',
  async (_, { dispatch }) => {
    try {
      const res = await api.get('/assets');
      dispatch(setAssets(res.data));
    } catch (error) {
      console.error('Failed to load assets', error);
    }
  }
);

const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      return resolve(file.type.startsWith('image/') ? 5 : 10);
    }
    try {
      const url = URL.createObjectURL(file);
      const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(media.duration || 10);
      };
      media.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(10);
      };
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(10);
      }, 2000);
      media.src = url;
    } catch {
      resolve(10);
    }
  });
};

export const uploadAsset = createAsyncThunk(
  'editor/uploadAsset',
  async (payload: File | { file: File; tempId?: string }, { dispatch }) => {
    const file = payload instanceof File ? payload : payload.file;
    const tempId = (payload instanceof File ? undefined : payload.tempId) || `temp_${Date.now()}`;

    // Initialize progress tracking
    dispatch(
      setUploadProgress({
        tempId,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      })
    );

    const duration = await getVideoDuration(file);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('duration', duration.toString());

    try {
      const response = await api.post('/assets', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.min(99, Math.round((progressEvent.loaded * 100) / progressEvent.total));
            dispatch(
              setUploadProgress({
                tempId,
                fileName: file.name,
                progress: percent,
                status: percent >= 99 ? 'processing' : 'uploading',
              })
            );
          }
        },
      });

      dispatch(
        setUploadProgress({
          tempId,
          fileName: file.name,
          progress: 100,
          status: 'completed',
        })
      );

      if (tempId && response.data) {
        dispatch(replaceOptimisticAsset({ tempId, realAsset: response.data }));
      }
      await dispatch(loadAssets());

      setTimeout(() => {
        dispatch(removeUploadProgress(tempId));
      }, 1200);

      dispatch(addToast({ type: 'success', message: `"${file.name}" uploaded successfully!` }));
      return response.data;
    } catch (error: any) {
      dispatch(
        setUploadProgress({
          tempId,
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: error?.response?.data?.message || error.message || 'Upload failed',
        })
      );
      dispatch(removeOptimisticAsset(tempId));
      dispatch(
        addToast({
          type: 'error',
          message: `Upload failed: ${error?.response?.data?.message || error.message || 'Unknown error'}`,
        })
      );
      throw error;
    }
  }
);

export const deleteAsset = createAsyncThunk(
  'editor/deleteAsset',
  async (assetId: string, { dispatch }) => {
    await api.delete(`/assets/${assetId}`);
    dispatch(loadAssets());
  }
);

export const createProject = createAsyncThunk(
  'editor/createProject',
  async (title: string | undefined, { dispatch }) => {
    try {
      const res = await api.post('/projects', { title: title || 'New Video' });
      dispatch(setProject({ 
        projectId: res.data.project._id, 
        sceneGraph: res.data.sceneGraph 
      }));
      return res.data;
    } catch (error) {
      console.error('Failed to create project', error);
    }
  }
);

export const loadProject = createAsyncThunk(
  'editor/loadProject',
  async (projectId: string, { dispatch }) => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      dispatch(setProject({ 
        projectId: res.data.project._id, 
        sceneGraph: res.data.sceneGraph 
      }));
      return res.data;
    } catch (error) {
      console.error('Failed to load project', error);
    }
  }
);

export const triggerAutosave = createAsyncThunk(
  'editor/triggerAutosave',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { activeProjectId, sceneGraph } = state.editor;
    
    if (!activeProjectId || !sceneGraph) return;

    try {
      await api.put(`/projects/${activeProjectId}/autosave`, {
        sceneGraph: sceneGraph
      });
      console.log('Autosaved project');
    } catch (error) {
      console.error('Autosave failed', error);
    }
  }
);

export const exportVideo = createAsyncThunk(
  'editor/exportVideo',
  async (options: { mode?: 'browser' | 'server' } | void, { dispatch, getState }) => {
    // Cancel any active browser export loop before launching new export
    cancelCurrentBrowserExport();

    const state = getState() as RootState;
    const { sceneGraph, exportModePreference } = state.editor;
    if (!sceneGraph) return;

    const targetMode = options?.mode || exportModePreference || 'server';

    // Clone sceneGraph and resolve any blob: URLs to server URLs before sending
    const updatedSceneGraph = JSON.parse(JSON.stringify(sceneGraph));
    let hasBlobUrl = false;
    let pendingFile = '';

    for (const track of updatedSceneGraph.tracks || []) {
      for (const clip of track.clips || []) {
        const url = clip.asset?.original_url || clip.asset?.preview_url || '';
        if (url.startsWith('blob:')) {
          const matchedAsset = state.editor.assets.find(
            (a) => a._id === clip.assetId || a.public_id === clip.asset?.public_id
          );
          if (matchedAsset && !matchedAsset.original_url.startsWith('blob:')) {
            clip.asset.original_url = matchedAsset.original_url;
            clip.asset.preview_url = matchedAsset.preview_url;
          } else {
            hasBlobUrl = true;
            pendingFile = clip.asset?.public_id || 'media file';
          }
        }
      }
    }

    if (hasBlobUrl) {
      dispatch({ type: 'editor/setExporting', payload: false });
      dispatch(
        addToast({
          type: 'warning',
          message: `"${pendingFile}" is still uploading in the background. Please wait a moment for upload to complete before exporting.`,
        })
      );
      throw new Error(`Media "${pendingFile}" is still uploading. Please wait a moment.`);
    }

    dispatch({ type: 'editor/setExporting', payload: true });

    // ───────────────────────────────────────────────────────────
    // User-Selected Render Target Execution
    // targetMode = 'browser' (Local WebCodecs/WASM) or 'server' (Cloud FFmpeg)
    // ───────────────────────────────────────────────────────────
    try {
      const { canRender, capabilities, estimatedSec, reason } = await canRenderInBrowser(updatedSceneGraph, targetMode);

      if (canRender) {
        const encoderLabel =
          capabilities.recommendedEncoder === 'webcodecs' ? 'WebCodecs H.264 (hardware)' :
          capabilities.recommendedEncoder === 'wasm' ? 'ffmpeg.wasm (WASM)' :
          'MediaRecorder (WebM)';

        dispatch(
          addToast({
            type: 'info',
            message: `🚀 Rendering in browser using ${encoderLabel} (~${Math.ceil(estimatedSec)}s estimated)`,
          })
        );

        dispatch(setExportProgressDetails({
          percent: 2,
          eta: Math.ceil(estimatedSec),
          status: `Browser Engine (${encoderLabel})`,
        }));

        // Execute browser-side export
        await exportInBrowser(updatedSceneGraph, {
          onProgress: (percent, status, etaSec) => {
            dispatch(setExportProgressDetails({
              percent,
              eta: etaSec !== null ? Math.ceil(etaSec) : null,
              status,
            }));
          },
          onComplete: (url) => {
            dispatch(setExportUrl(url));
            dispatch(loadAssets());
            dispatch(addToast({ type: 'success', message: '🎬 Browser export complete! Click download to save.' }));
          },
          onError: (message) => {
            console.warn('[BrowserExport] Failed, falling back to server:', message);
            dispatch(addToast({ type: 'warning', message: `Browser export failed: ${message}. Falling back to server...` }));
          },
        });

        // If exportUrl was set by onComplete, we're done
        const postState = (getState() as RootState).editor;
        if (postState.exportUrl) return;

        dispatch(addToast({ type: 'info', message: '⚙️ Switching to server-side rendering...' }));
      } else {
        console.log(`[ExportRouter] Server route: ${reason}`);
        dispatch(setExportProgressDetails({
          percent: 2,
          eta: null,
          status: `Cloud Server FFmpeg Engine`,
        }));
      }
    } catch (routerError) {
      console.warn('[ExportRouter] Capability check failed, using server:', routerError);
    }

    // ───────────────────────────────────────────────────────────
    // Server-Side FFmpeg Export (original path)
    // ───────────────────────────────────────────────────────────
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sceneGraph: updatedSceneGraph }),
      });

      if (!response.body) throw new Error('No response stream received');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'progress') {
              dispatch(setExportProgressDetails({
                percent: data.percent,
                eta: data.etaSeconds !== undefined ? data.etaSeconds : null,
                status: data.status || 'rendering'
              }));
            } else if (data.type === 'complete') {
              dispatch(setExportUrl(data.url));
              dispatch(loadAssets());
              dispatch(addToast({ type: 'success', message: '🎬 Export complete! Click download to save.' }));
            } else if (data.type === 'error') {
              console.error('Export error:', data.message);
              dispatch(setExporting(false));
              dispatch(addToast({ type: 'error', message: `Export failed: ${data.message}` }));
            }
          } catch (e) {
            console.warn('Failed to parse SSE JSON line:', trimmed, e);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            processLine(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep trailing incomplete line in buffer

        for (const line of lines) {
          processLine(line);
        }
      }
    } catch (error) {
      console.error("Failed to export video", error);
      dispatch({ type: 'editor/setExporting', payload: false });
    }
  }
);

