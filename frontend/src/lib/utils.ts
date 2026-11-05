import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getMediaUrl } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Direct native browser media file downloader.
 * Triggers instant native download stream in the browser's download bar
 * with live MB/s progress instead of buffering whole file in RAM.
 */
export async function downloadMediaFile(
  url?: string | null,
  suggestedName?: string,
): Promise<boolean> {
  if (!url) return false;

  const fullUrl = getMediaUrl(url);
  const cleanUrl = fullUrl.split("?")[0] || "";
  const urlParts = cleanUrl.split("/");
  const defaultFilename =
    urlParts[urlParts.length - 1] || `video_${Date.now()}.mp4`;
  const filename = (suggestedName || defaultFilename).replace(
    /[/\\?%*:|"<>]/g,
    "_",
  );

  // Direct native browser download stream trigger (0s delay, live progress bar in browser)
  const a = document.createElement("a");
  a.href = fullUrl;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
export const formatTimeCode = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
