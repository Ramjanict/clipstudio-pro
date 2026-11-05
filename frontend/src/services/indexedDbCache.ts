/**
 * Persistent Browser IndexedDB Cache for Video and Media Blobs.
 * Allows storing large video files directly on the user's hard drive.
 * Survives browser restarts, page reloads, and offline sessions.
 */

const DB_NAME = "VideoEditorMediaCache";
const DB_VERSION = 1;
const STORE_NAME = "media_blobs";

interface StoredBlobRecord {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Save a media Blob to IndexedDB.
 */
export async function saveMediaBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const record: StoredBlobRecord = {
        key,
        blob,
        mimeType: blob.type || "video/mp4",
        size: blob.size,
        updatedAt: Date.now(),
      };

      const putRequest = store.put(record);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Failed to save blob for key: ${key}`, err);
  }
}

/**
 * Retrieve a media Blob from IndexedDB by key.
 */
export async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        const record = getRequest.result as StoredBlobRecord | undefined;
        if (record && record.blob) {
          resolve(record.blob);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error fetching blob for key: ${key}`, err);
    return null;
  }
}

/**
 * Check if a media Blob exists in IndexedDB.
 */
export async function hasMediaBlob(key: string): Promise<boolean> {
  const blob = await getMediaBlob(key);
  return blob !== null;
}

/**
 * Remove a specific media Blob from IndexedDB.
 */
export async function deleteMediaBlob(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Failed to delete key: ${key}`, err);
  }
}

/**
 * Clear the entire media cache from IndexedDB.
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Failed to clear media cache", err);
  }
}

export interface FrameData {
  time: number;
  dataUrl: string;
}

/**
 * Save asset frame snapshots to IndexedDB.
 */
export async function saveAssetFrameSnapshots(assetId: string, frames: FrameData[]): Promise<void> {
  try {
    const key = `frames_${assetId}`;
    const blob = new Blob([JSON.stringify(frames)], { type: "application/json" });
    await saveMediaBlob(key, blob);
  } catch (err) {
    console.warn(`[IndexedDB] Failed to save frame snapshots for asset: ${assetId}`, err);
  }
}

/**
 * Retrieve asset frame snapshots from IndexedDB.
 */
export async function getAssetFrameSnapshots(assetId: string): Promise<FrameData[]> {
  try {
    const key = `frames_${assetId}`;
    const blob = await getMediaBlob(key);
    if (!blob) return [];
    const text = await blob.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[IndexedDB] Failed to get frame snapshots for asset: ${assetId}`, err);
    return [];
  }
}
