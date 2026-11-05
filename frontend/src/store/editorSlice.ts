import type { Asset, Clip, SceneGraph, Track } from "@/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { mediaManager } from "@/services/mediaManager";

export interface UploadingItem {
  tempId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface EditorState {
  activeProjectId: string | null;
  sceneGraph: SceneGraph | null;
  assets: Asset[];
  uploadingAssets: Record<string, UploadingItem>;
  playhead: number;
  selectedClipId: string | null;
  isExportModalOpen: boolean;
  isExporting: boolean;
  exportProgress: number;
  exportUrl: string | null;
  isPlaying: boolean;
  exportEta: number | null;
  exportStatus: string;
  exportModePreference: 'browser' | 'server';
  // Undo/redo history
  past: SceneGraph[];
  future: SceneGraph[];
}

const initialState: EditorState = {
  activeProjectId: null,
  sceneGraph: null,
  assets: [],
  uploadingAssets: {},
  playhead: 0,
  selectedClipId: null,
  isExportModalOpen: false,
  isExporting: false,
  exportProgress: 0,
  exportUrl: null,
  isPlaying: false,
  exportEta: null,
  exportStatus: 'preparing',
  exportModePreference: 'server',
  past: [],
  future: [],
};
const normalizeTrackLayers = (sceneGraph: SceneGraph) => {
  if (!sceneGraph || !sceneGraph.tracks) return;

  // Strictly remove unused empty tracks (0 clips)
  const nonEmpTracks = sceneGraph.tracks.filter((track) => track.clips && track.clips.length > 0);
  if (nonEmpTracks.length > 0) {
    sceneGraph.tracks = nonEmpTracks;
  } else {
    // If project has 0 total clips, keep only 1 default track
    sceneGraph.tracks = sceneGraph.tracks.slice(0, 1);
    if (sceneGraph.tracks.length === 0) {
      sceneGraph.tracks = [{ id: "track_video_default", type: "video", clips: [] }];
    }
  }

  const overlayTracks: Track[] = [];
  const videoTracks: Track[] = [];
  const audioTracks: Track[] = [];

  for (const track of sceneGraph.tracks) {
    const hasOverlayClips = track.clips.some((c) =>
      ["text", "qr", "shape", "slider"].includes(c.asset?.type)
    );
    if (track.type === "audio") {
      audioTracks.push(track);
    } else if (hasOverlayClips || track.type === "text") {
      overlayTracks.push(track);
    } else {
      videoTracks.push(track);
    }
  }

  sceneGraph.tracks = [...overlayTracks, ...videoTracks, ...audioTracks];
};

// Utility function to recalculate project duration based on clips in the scene graph
const recalculateDuration = (state: EditorState) => {
  if (!state.sceneGraph) return;
  normalizeTrackLayers(state.sceneGraph);
  let maxEndTime = 0; // Minimum duration is 0
  for (const track of state.sceneGraph.tracks) {
    for (const clip of track.clips) {
      if (clip.endTime > maxEndTime) {
        maxEndTime = clip.endTime;
      }
    }
  }
  state.sceneGraph.duration = maxEndTime;
  if (state.playhead > maxEndTime) {
    state.playhead = maxEndTime;
  }
};

// Snapshot current sceneGraph into past before mutation (max 50 steps)
const snapshotHistory = (state: EditorState) => {
  if (!state.sceneGraph) return;
  state.past = [...state.past, JSON.parse(JSON.stringify(state.sceneGraph))].slice(-50);
  state.future = [];
};

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    undo: (state) => {
      if (state.past.length === 0) return;
      const previous = state.past[state.past.length - 1];
      state.past = state.past.slice(0, -1);
      if (state.sceneGraph) state.future = [JSON.parse(JSON.stringify(state.sceneGraph)), ...state.future].slice(0, 50);
      state.sceneGraph = previous;
      recalculateDuration(state);
    },
    redo: (state) => {
      if (state.future.length === 0) return;
      const next = state.future[0];
      state.future = state.future.slice(1);
      if (state.sceneGraph) state.past = [...state.past, JSON.parse(JSON.stringify(state.sceneGraph))].slice(-50);
      state.sceneGraph = next;
      recalculateDuration(state);
    },
    setPlayhead: (state, action: PayloadAction<number>) => {
      state.playhead = action.payload;
    },
    togglePlay: (state) => {
      if (!state.isPlaying && state.sceneGraph) {
        let maxClipEnd = 0;
        for (const track of state.sceneGraph.tracks) {
          for (const clip of track.clips) {
            if (clip.endTime > maxClipEnd) {
              maxClipEnd = clip.endTime;
            }
          }
        }
        const effectiveDuration = maxClipEnd > 0 ? maxClipEnd : (state.sceneGraph.duration ?? 0);
        if (effectiveDuration > 0 && state.playhead >= effectiveDuration - 0.2) {
          state.playhead = 0;
        }
      }
      state.isPlaying = !state.isPlaying;
    },
    setAssets: (state, action: PayloadAction<Asset[]>) => {
      state.assets = action.payload;
    },
    setUploadProgress: (
      state,
      action: PayloadAction<UploadingItem>,
    ) => {
      state.uploadingAssets[action.payload.tempId] = action.payload;
    },
    removeUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadingAssets[action.payload];
    },
    removeOptimisticAsset: (state, action: PayloadAction<string>) => {
      state.assets = state.assets.filter((a) => a._id !== action.payload);
      delete state.uploadingAssets[action.payload];
    },
    addOptimisticAsset: (state, action: PayloadAction<Asset>) => {
      state.assets.unshift(action.payload);
    },
    replaceOptimisticAsset: (
      state,
      action: PayloadAction<{ tempId: string; realAsset: Asset }>,
    ) => {
      delete state.uploadingAssets[action.payload.tempId];
      mediaManager.aliasAssetKey(action.payload.tempId, action.payload.realAsset._id);
      const existing = state.assets.find((a) => a._id === action.payload.tempId);
      const localPreviewUrl = existing?.preview_url?.startsWith("blob:")
        ? existing.preview_url
        : undefined;

      const mergedAsset: Asset = {
        ...action.payload.realAsset,
        preview_url: localPreviewUrl || action.payload.realAsset.preview_url || action.payload.realAsset.original_url,
      };

      const idx = state.assets.findIndex((a) => a._id === action.payload.tempId);
      if (idx !== -1) {
        state.assets[idx] = mergedAsset;
      } else {
        const exists = state.assets.some((a) => a._id === mergedAsset._id);
        if (!exists) state.assets.unshift(mergedAsset);
      }
      if (state.sceneGraph) {
        for (const track of state.sceneGraph.tracks) {
          for (const clip of track.clips) {
            if (clip.assetId === action.payload.tempId || clip.asset._id === action.payload.tempId) {
              clip.assetId = mergedAsset._id;
              clip.asset = mergedAsset;
            }
          }
        }
      }
    },
    setProject: (
      state,
      action: PayloadAction<{ projectId: string; sceneGraph: SceneGraph }>,
    ) => {
      state.activeProjectId = action.payload.projectId;
      state.sceneGraph = action.payload.sceneGraph;
      recalculateDuration(state);
    },
    setSelectedClip: (state, action: PayloadAction<string | null>) => {
      state.selectedClipId = action.payload;
    },
    addAssetToTimeline: (
      state,
      action: PayloadAction<{
        asset: Asset;
        trackId?: string;
        startTime?: number;
      }>,
    ) => {
      if (!state.sceneGraph) return;
      snapshotHistory(state);

      const { asset } = action.payload;
      const startTime = action.payload.startTime ?? state.playhead;
      const isAudio = asset.type === "audio";
      const isOverlay = ["text", "qr", "shape", "slider"].includes(asset.type);
      const targetType = isAudio ? "audio" : isOverlay ? "text" : "video";

      const clipDuration = asset.duration || 5;
      const isShape = asset.type === "shape";
      const isText = asset.type === "text";
      const isLine = asset.content === "Line" || asset.content === "line";

      const newClip: Clip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        assetId: asset._id,
        asset: asset,
        startTime: startTime,
        endTime: startTime + clipDuration,
        trimIn: 0,
        trimOut: clipDuration,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          width: isShape ? 200 : undefined,
          height: isShape ? 150 : undefined,
        },
        shapeStyles: isShape
          ? {
              shapeType: (asset.content as any) || "Rectangle",
              fillColor: isLine ? "transparent" : "#38bdf8",
              strokeColor: "#38bdf8",
              strokeWidth: isLine ? 4 : 0,
              borderRadius: 8,
            }
          : undefined,
        textStyles: isText
          ? {
              content: asset.content || "Title Goes There",
              fontSize: 48,
              fontFamily: "Inter",
              fontWeight: "Bold",
              color: "#ffffff",
              align: "center",
            }
          : undefined,
      };

      let targetTrack: Track | undefined;

      if (action.payload.trackId) {
        targetTrack = state.sceneGraph.tracks.find((t) => t.id === action.payload.trackId);
      }

      if (!targetTrack) {
        targetTrack = state.sceneGraph.tracks.find((t) => {
          if (t.type !== targetType && !(isOverlay && t.type === "text")) return false;
          const collision = t.clips.some(
            (c) =>
              (startTime >= c.startTime && startTime < c.endTime) ||
              (startTime + clipDuration > c.startTime && startTime + clipDuration <= c.endTime) ||
              (startTime <= c.startTime && startTime + clipDuration >= c.endTime)
          );
          return !collision;
        });
      }

      if (!targetTrack) {
        const newTrackId = `track_${targetType}_${Date.now()}`;
        targetTrack = {
          id: newTrackId,
          type: targetType,
          clips: [],
        };
        if (isOverlay) {
          state.sceneGraph.tracks.unshift(targetTrack);
        } else {
          state.sceneGraph.tracks.push(targetTrack);
        }
      }

      targetTrack.clips.push(newClip);
      state.selectedClipId = newClip.id;
      recalculateDuration(state);
    },
    updateClip: (
      state,
      action: PayloadAction<{
        trackId: string;
        clipId: string;
        updates: Partial<Clip>;
      }>,
    ) => {
      if (!state.sceneGraph) return;
      const { trackId, clipId, updates } = action.payload;

      const track = state.sceneGraph.tracks.find((t) => t.id === trackId);
      if (track) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          Object.assign(clip, updates);
          recalculateDuration(state);
        }
      }
    },
    duplicateClip: (state, action: PayloadAction<string>) => {
      if (!state.sceneGraph) return;
      const clipId = action.payload;

      let targetClip: Clip | null = null;
      let targetTrack: any = null;

      for (const track of state.sceneGraph.tracks) {
        const c = track.clips.find((clip) => clip.id === clipId);
        if (c) {
          targetClip = c;
          targetTrack = track;
          break;
        }
      }

      if (!targetClip || !targetTrack) return;
      snapshotHistory(state);

      const duration = targetClip.endTime - targetClip.startTime;
      let newStartTime = targetClip.endTime;
      let newEndTime = newStartTime + duration;

      const hasOverlap = (start: number, end: number) => {
        return targetTrack.clips.some(
          (c: Clip) =>
            (start >= c.startTime && start < c.endTime) ||
            (end > c.startTime && end <= c.endTime) ||
            (start <= c.startTime && end >= c.endTime)
        );
      };

      if (hasOverlap(newStartTime, newEndTime)) {
        const maxTrackEnd = targetTrack.clips.reduce(
          (max: number, c: Clip) => Math.max(max, c.endTime),
          0
        );
        newStartTime = maxTrackEnd;
        newEndTime = newStartTime + duration;
      }

      const duplicatedClip: Clip = {
        ...JSON.parse(JSON.stringify(targetClip)),
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        startTime: newStartTime,
        endTime: newEndTime,
      };

      targetTrack.clips.push(duplicatedClip);
      state.selectedClipId = duplicatedClip.id;
      recalculateDuration(state);
    },
    splitClip: (
      state,
      action: PayloadAction<{
        trackId?: string;
        clipId?: string;
        splitAtTime?: number;
      }>,
    ) => {
      if (!state.sceneGraph) return;

      const splitTime = action.payload.splitAtTime ?? state.playhead;
      const targetClipId = action.payload.clipId || state.selectedClipId;

      const performSplitOnClip = (track: any, clipIndex: number) => {
        const originalClip = track.clips[clipIndex];
        if (splitTime <= originalClip.startTime || splitTime >= originalClip.endTime) {
          return false;
        }

        const splitOffset = splitTime - originalClip.startTime;

        const newClip: Clip = {
          ...originalClip,
          id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          startTime: splitTime,
          endTime: originalClip.endTime,
          trimIn: (originalClip.trimIn || 0) + splitOffset,
          trimOut: originalClip.trimOut,
        };

        originalClip.endTime = splitTime;
        originalClip.trimOut = (originalClip.trimIn || 0) + splitOffset;

        track.clips.splice(clipIndex + 1, 0, newClip);
        return true;
      };

      let splitOccurred = false;

      if (targetClipId) {
        for (const track of state.sceneGraph.tracks) {
          if (action.payload.trackId && track.id !== action.payload.trackId) continue;
          const clipIndex = track.clips.findIndex((c) => c.id === targetClipId);
          if (clipIndex !== -1) {
            if (!splitOccurred) snapshotHistory(state);
            splitOccurred = performSplitOnClip(track, clipIndex);
            if (splitOccurred) break;
          }
        }
      }

      if (!splitOccurred) {
        for (const track of state.sceneGraph.tracks) {
          const clipIndex = track.clips.findIndex(
            (c) => splitTime > c.startTime && splitTime < c.endTime,
          );
          if (clipIndex !== -1) {
            if (!splitOccurred) snapshotHistory(state);
            if (performSplitOnClip(track, clipIndex)) {
              splitOccurred = true;
            }
          }
        }
      }

      if (splitOccurred) {
        recalculateDuration(state);
      }
    },
    deleteClip: (state, action: PayloadAction<string>) => {
      if (!state.sceneGraph) return;
      snapshotHistory(state);
      const clipId = action.payload;
      for (const track of state.sceneGraph.tracks) {
        const index = track.clips.findIndex((c) => c.id === clipId);
        if (index !== -1) {
          track.clips.splice(index, 1);
          if (state.selectedClipId === clipId) {
            state.selectedClipId = null;
          }
          break;
        }
      }
      recalculateDuration(state);
    },
    deleteTrack: (state, action: PayloadAction<string>) => {
      if (!state.sceneGraph) return;
      const trackId = action.payload;

      const trackIndex = state.sceneGraph.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex !== -1) {
        snapshotHistory(state);
        const trackToDelete = state.sceneGraph.tracks[trackIndex];
        if (state.selectedClipId) {
          const hasSelectedClip = trackToDelete.clips.some((c) => c.id === state.selectedClipId);
          if (hasSelectedClip) {
            state.selectedClipId = null;
          }
        }
        state.sceneGraph.tracks.splice(trackIndex, 1);
        recalculateDuration(state);
      }
    },
    addTrack: (
      state,
      action: PayloadAction<{ type?: "video" | "audio" | "text" } | undefined>
    ) => {
      if (!state.sceneGraph) return;
      snapshotHistory(state);

      const trackType = action?.payload?.type || "video";
      const newTrackId = `track_${trackType}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

      const newTrack: Track = {
        id: newTrackId,
        type: trackType,
        clips: [],
      };

      state.sceneGraph.tracks.push(newTrack);
    },
    separateAudio: (
      state,
      action: PayloadAction<{
        clipId?: string;
        regionStart?: number;
        regionEnd?: number;
        muteOriginal?: boolean;
      }>,
    ) => {
      if (!state.sceneGraph) return;

      const targetClipId = action.payload.clipId || state.selectedClipId;
      let foundClip: Clip | null = null;

      if (targetClipId) {
        for (const track of state.sceneGraph.tracks) {
          const c = track.clips.find((clip) => clip.id === targetClipId);
          if (c) {
            foundClip = c;
            break;
          }
        }
      }

      if (!foundClip) {
        const time = state.playhead;
        for (const track of state.sceneGraph.tracks) {
          if (track.type === "video") {
            const c = track.clips.find((clip) => time >= clip.startTime && time <= clip.endTime);
            if (c) {
              foundClip = c;
              break;
            }
          }
        }
      }

      if (!foundClip) return;
      snapshotHistory(state);

      const isRegion =
        action.payload.regionStart !== undefined &&
        action.payload.regionEnd !== undefined &&
        action.payload.regionStart < action.payload.regionEnd;

      let startTime = foundClip.startTime;
      let endTime = foundClip.endTime;
      let trimIn = foundClip.trimIn;
      let trimOut = foundClip.trimOut;

      if (isRegion) {
        const rStart = Math.max(foundClip.startTime, action.payload.regionStart!);
        const rEnd = Math.min(foundClip.endTime, action.payload.regionEnd!);
        if (rStart < rEnd) {
          const offsetStart = rStart - foundClip.startTime;
          const offsetEnd = rEnd - foundClip.startTime;
          startTime = rStart;
          endTime = rEnd;
          trimIn = (foundClip.trimIn || 0) + offsetStart;
          trimOut = (foundClip.trimIn || 0) + offsetEnd;
        }
      }

      let audioTrack = state.sceneGraph.tracks.find((t) => t.type === "audio");
      if (!audioTrack) {
        const audioTrackId = `track_audio_${Date.now()}`;
        audioTrack = {
          id: audioTrackId,
          type: "audio",
          clips: [],
        };
        state.sceneGraph.tracks.push(audioTrack);
      }

      const hasOverlap = audioTrack.clips.some(
        (c) =>
          (startTime >= c.startTime && startTime < c.endTime) ||
          (endTime > c.startTime && endTime <= c.endTime) ||
          (startTime <= c.startTime && endTime >= c.endTime),
      );

      if (hasOverlap) {
        const newAudioTrackId = `track_audio_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        audioTrack = {
          id: newAudioTrackId,
          type: "audio",
          clips: [],
        };
        state.sceneGraph.tracks.push(audioTrack);
      }

      const extractedAudioClip: Clip = {
        id: `clip_audio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        assetId: foundClip.assetId,
        asset: {
          ...foundClip.asset,
          type: "audio",
          public_id: foundClip.asset?.public_id
            ? `${foundClip.asset.public_id} (Sound)`
            : "Separated Sound",
        },
        startTime,
        endTime,
        trimIn,
        trimOut,
      };

      // Mute the original video clip so sound is not duplicated
      foundClip.muted = true;
      foundClip.volume = 0;

      audioTrack.clips.push(extractedAudioClip);
      state.selectedClipId = extractedAudioClip.id;
      recalculateDuration(state);
    },
    moveClip: (
      state,
      action: PayloadAction<{
        clipId: string;
        newStartTime: number;
        newTrackId?: string;
      }>,
    ) => {
      if (!state.sceneGraph) return;
      const { clipId, newStartTime, newTrackId } = action.payload;

      let targetClip: Clip | null = null;
      let sourceTrack: any = null;

      for (let i = 0; i < state.sceneGraph.tracks.length; i++) {
        const track = state.sceneGraph.tracks[i];
        const clipIndex = track.clips.findIndex((c) => c.id === clipId);
        if (clipIndex !== -1) {
          targetClip = track.clips[clipIndex];
          sourceTrack = track;
          break;
        }
      }

      if (targetClip && sourceTrack) {
        const duration = targetClip.endTime - targetClip.startTime;
        let proposedStart = Math.max(0, newStartTime);
        let proposedEnd = proposedStart + duration;

        // Determine destination track with strict type validation
        let destTrack = sourceTrack;
        if (newTrackId && newTrackId !== sourceTrack.id) {
          const foundDestTrack = state.sceneGraph.tracks.find(
            (t) => t.id === newTrackId,
          );
          if (foundDestTrack) {
            const isAudioClip = targetClip.asset?.type === "audio";
            const isDestAudio = foundDestTrack.type === "audio";
            // Strictly enforce track type match
            if (isAudioClip === isDestAudio) {
              destTrack = foundDestTrack;
            }
          }
        }

        // Collision Detection against other clips on the destination track
        let hasCollision = false;
        for (const otherClip of destTrack.clips) {
          if (otherClip.id === clipId) continue;

          if (
            (proposedStart >= otherClip.startTime &&
              proposedStart < otherClip.endTime) ||
            (proposedEnd > otherClip.startTime &&
              proposedEnd <= otherClip.endTime) ||
            (proposedStart <= otherClip.startTime &&
              proposedEnd >= otherClip.endTime)
          ) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          if (destTrack.id !== sourceTrack.id) {
            const clipIndex = sourceTrack.clips.findIndex(
              (c: Clip) => c.id === clipId,
            );
            if (clipIndex !== -1) {
              const [clipToMove] = sourceTrack.clips.splice(clipIndex, 1);
              clipToMove.startTime = proposedStart;
              clipToMove.endTime = proposedEnd;
              destTrack.clips.push(clipToMove);
            }
          } else {
            targetClip.startTime = proposedStart;
            targetClip.endTime = proposedEnd;
          }

          recalculateDuration(state);
        }
      }
    },
    openExportModal: (state) => {
      state.isExportModalOpen = true;
    },
    closeExportModal: (state) => {
      state.isExportModalOpen = false;
      state.isExporting = false;
      state.exportProgress = 0;
      state.exportUrl = null;
    },
    setExporting: (state, action: PayloadAction<boolean>) => {
      state.isExporting = action.payload;
      if (action.payload) {
        state.isExportModalOpen = true;
        state.exportProgress = 0;
        state.exportUrl = null;
        state.exportEta = null;
        state.exportStatus = 'preparing';
      }
    },
    setExportProgress: (state, action: PayloadAction<number>) => {
      state.exportProgress = action.payload;
    },
    setExportProgressDetails: (state, action: PayloadAction<{ percent: number; eta: number | null; status: string }>) => {
      state.exportProgress = action.payload.percent;
      state.exportEta = action.payload.eta;
      state.exportStatus = action.payload.status;
    },
    setExportUrl: (state, action: PayloadAction<string | null>) => {
      state.exportUrl = action.payload;
    },
    setExportModePreference: (state, action: PayloadAction<'browser' | 'server'>) => {
      state.exportModePreference = action.payload;
    },
    resetEditor: (state) => {
      state.activeProjectId = null;
      state.sceneGraph = null;
      state.assets = [];
      state.playhead = 0;
      state.selectedClipId = null;
      state.isExportModalOpen = false;
      state.isExporting = false;
      state.exportProgress = 0;
      state.exportUrl = null;
      state.isPlaying = false;
      state.exportEta = null;
      state.exportStatus = 'preparing';
      state.exportModePreference = 'server';
      state.past = [];
      state.future = [];
    },
  },
});

export const {
  undo,
  redo,
  setProject,
  setAssets,
  setUploadProgress,
  removeUploadProgress,
  removeOptimisticAsset,
  addOptimisticAsset,
  replaceOptimisticAsset,
  addAssetToTimeline,
  updateClip,
  duplicateClip,
  splitClip,
  separateAudio,
  deleteClip,
  deleteTrack,
  addTrack,
  moveClip,
  setPlayhead,
  setSelectedClip,
  openExportModal,
  closeExportModal,
  setExporting,
  setExportProgress,
  setExportProgressDetails,
  setExportUrl,
  setExportModePreference,
  togglePlay,
  resetEditor,
} = editorSlice.actions;

export default editorSlice.reducer;
