/**
 * Global Media Manager & In-Memory Cache.
 * Coordinates between In-Memory Blob URLs, Browser IndexedDB, and Remote Streaming URLs.
 * Eliminates duplicate network requests and enables 0ms seeking from RAM/SSD.
 */

import { getMediaBlob, saveMediaBlob } from "./indexedDbCache";

class MediaManager {
  // In-memory cache of object URLs: key -> "blob:http://..."
  private memoryBlobMap = new Map<string, string>();

  // In-flight fetches to prevent duplicate concurrent network downloads
  private inFlightMap = new Map<string, Promise<string>>();

  /**
   * Derive a clean, persistent cache key for an asset.
   */
  private getCacheKey(assetId: string | undefined, remoteUrl: string): string {
    if (assetId && !assetId.startsWith("temp_")) {
      return `asset_${assetId}`;
    }
    // Extract filename/path without query params
    const cleanUrl = remoteUrl.split("?")[0];
    const filename = cleanUrl.split("/").pop() || cleanUrl;
    return `media_${filename}`;
  }

  /**
   * Alias a cache key when a temporary optimistic asset ID is replaced by a real database ID.
   */
  aliasAssetKey(oldId: string, newId: string) {
    const oldKey = this.getCacheKey(oldId, "");
    const newKey = this.getCacheKey(newId, "");
    const blobUrl = this.memoryBlobMap.get(oldKey);
    if (blobUrl) {
      this.memoryBlobMap.set(newKey, blobUrl);
    }
  }

  /**
   * Register a local File or Blob (e.g. immediately upon user file selection/upload).
   * Caches in RAM and persists into IndexedDB.
   */
  async registerLocalBlob(assetId: string, fileOrBlob: Blob): Promise<string> {
    const key = this.getCacheKey(assetId, "");
    const blobUrl = URL.createObjectURL(fileOrBlob);
    this.memoryBlobMap.set(key, blobUrl);

    // Persist to IndexedDB in background
    saveMediaBlob(key, fileOrBlob).catch((err) => {
      console.warn(`[MediaManager] Failed to persist blob ${key} to IndexedDB:`, err);
    });

    return blobUrl;
  }

  /**
   * Get an instant synchronous blob URL if already present in memory.
   */
  getCachedBlobUrlSync(assetId: string | undefined, remoteUrl: string): string | null {
    if (remoteUrl && remoteUrl.startsWith("blob:")) {
      return remoteUrl;
    }
    const key = this.getCacheKey(assetId, remoteUrl);
    return this.memoryBlobMap.get(key) || null;
  }

  /**
   * Main entry point: Get or load a local blob URL for a media asset.
   * Priority:
   * 1. Already a blob URL -> return immediately.
   * 2. In-Memory Cache -> return immediately (0ms).
   * 3. In-flight download -> join existing Promise.
   * 4. IndexedDB -> retrieve from local disk (< 20ms, 0 network).
   * 5. Remote Network -> fetch once, persist to IndexedDB, return local blob URL.
   */
  async getOrLoadMediaBlobUrl(
    assetId: string | undefined,
    remoteUrl: string
  ): Promise<string> {
    if (!remoteUrl) return "";

    // 1. If already a local blob URL
    if (remoteUrl.startsWith("blob:")) {
      if (assetId) {
        const key = this.getCacheKey(assetId, remoteUrl);
        this.memoryBlobMap.set(key, remoteUrl);
      }
      return remoteUrl;
    }

    const key = this.getCacheKey(assetId, remoteUrl);

    // 2. In-Memory Cache
    const inMemory = this.memoryBlobMap.get(key);
    if (inMemory) {
      return inMemory;
    }

    // 3. In-Flight fetch deduplication
    const inFlight = this.inFlightMap.get(key);
    if (inFlight) {
      return inFlight;
    }

    // 4. Fetch flow (IndexedDB -> Network fallback)
    const fetchPromise = (async () => {
      try {
        // A. Check IndexedDB
        const cachedBlob = await getMediaBlob(key);
        if (cachedBlob && cachedBlob.size > 0) {
          const blobUrl = URL.createObjectURL(cachedBlob);
          this.memoryBlobMap.set(key, blobUrl);
          return blobUrl;
        }

        // B. Check Content-Length to avoid choking network on giant raw files (>80MB)
        try {
          const headRes = await fetch(remoteUrl, { method: "HEAD" });
          const len = headRes.headers.get("content-length");
          if (len && parseInt(len, 10) > 80 * 1024 * 1024) {
            console.log(
              `[MediaManager] File ${(parseInt(len, 10) / (1024 * 1024)).toFixed(1)}MB exceeds 80MB. Using native streaming.`
            );
            return remoteUrl;
          }
        } catch {
          // If HEAD is blocked, continue
        }

        // C. Fetch from network and store in IndexedDB
        const res = await fetch(remoteUrl, { mode: "cors" });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} fetching media`);
        }

        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          this.memoryBlobMap.set(key, blobUrl);

          // Persist to IndexedDB
          await saveMediaBlob(key, blob);
          return blobUrl;
        }

        return remoteUrl;
      } catch (err) {
        console.warn(`[MediaManager] Error loading blob for ${key}, falling back to remote URL:`, err);
        return remoteUrl;
      } finally {
        this.inFlightMap.delete(key);
      }
    })();

    this.inFlightMap.set(key, fetchPromise);
    return fetchPromise;
  }
}

export const mediaManager = new MediaManager();
