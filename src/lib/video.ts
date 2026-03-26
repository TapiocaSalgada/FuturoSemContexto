export type VideoSourceKind =
  | "google_drive"
  | "youtube"
  | "direct"
  | "embed"
  | "external";

export function detectVideoSource(
  url?: string | null,
  sourceType?: string | null,
): VideoSourceKind {
  if (!url) return "external";

  const normalized = url.toLowerCase();
  if (sourceType === "google_drive") return "google_drive";
  if (sourceType === "youtube") return "youtube";
  if (sourceType === "direct") return "direct";
  if (sourceType === "embed") return "embed";

  if (normalized.includes("drive.google.com")) return "google_drive";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }
  if (
    normalized.startsWith("/") ||
    /\.(mp4|m4v|webm|ogg|mov|m3u8)(\?|#|$)/.test(normalized)
  ) {
    return "direct";
  }

  return "embed";
}

export function toEmbeddableVideoUrl(
  url?: string | null,
  sourceType?: string | null,
) {
  if (!url) return "";

  const source = detectVideoSource(url, sourceType);
  if (source === "google_drive") {
    const directMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = directMatch?.[1] || queryMatch?.[1];
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : url;
  }

  if (source === "youtube") {
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    const videoId = shortMatch?.[1] || watchMatch?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : url;
  }

  return url;
}
