export type VideoSourceKind =
  | "google_drive"
  | "youtube"
  | "direct"
  | "embed"
  | "external";

function decodeLoose(value: string) {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function extractFirstHttpUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const decoded = decodeLoose(raw);
  const match = decoded.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match?.[0]) return "";

  return match[0].replace(/[),.;]+$/, "");
}

export function getGoogleDriveFileId(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const fromPath = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    const fromId = parsed.searchParams.get("id") || "";

    return String(fromPath || fromId || "").trim();
  } catch {
    const fromPath = raw.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    const fromId = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
    return String(fromPath || fromId || "").trim();
  }
}

export function buildGoogleDriveDirectCandidates(url?: string | null) {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return [] as string[];

  const candidates = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/uc?id=${fileId}&export=download`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];

  return Array.from(new Set(candidates));
}

export function extractNestedMediaUrl(url?: string | null) {
  if (!url) return "";
  const normalized = normalizePlaybackUrl(url);

  try {
    const parsed = new URL(normalized);
    const candidateKeys = [
      "url",
      "src",
      "source",
      "file",
      "video",
      "stream",
      "play",
      "playlist",
      "m3u8",
      "mp4",
      "link",
    ];

    for (const key of candidateKeys) {
      const raw = parsed.searchParams.get(key);
      const extracted = extractFirstHttpUrl(raw || "");
      if (extracted) {
        return normalizePlaybackUrl(extracted);
      }
    }

    for (const value of parsed.searchParams.values()) {
      const extracted = extractFirstHttpUrl(value || "");
      if (extracted) {
        return normalizePlaybackUrl(extracted);
      }
    }
  } catch {
    const fallback = extractFirstHttpUrl(normalized);
    return fallback ? normalizePlaybackUrl(fallback) : "";
  }

  return "";
}

export function normalizePlaybackUrl(url?: string | null) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("drive.google.com") || host.includes("drive.usercontent.google.com")) {
      const fileId = getGoogleDriveFileId(parsed.toString());
      if (!fileId) return parsed.toString();

      const pathname = parsed.pathname.toLowerCase();
      const exportParam = parsed.searchParams.get("export")?.toLowerCase();
      const isDownloadLike =
        pathname.startsWith("/uc") ||
        pathname.includes("/download") ||
        exportParam === "download";

      if (isDownloadLike) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    if (host.includes("dropbox.com")) {
      parsed.searchParams.delete("dl");
      parsed.searchParams.set("raw", "1");
      return parsed.toString();
    }

    if (parsed.searchParams.get("download") === "1") {
      parsed.searchParams.delete("download");
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function detectVideoSource(
  url?: string | null,
  sourceType?: string | null,
): VideoSourceKind {
  if (!url) return "external";

  const normalizedUrl = normalizePlaybackUrl(url);

  const normalized = normalizedUrl.toLowerCase();
  let host = "";
  let pathname = "";
  let search = "";

  try {
    const parsed = new URL(normalizedUrl);
    host = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
    search = parsed.search.toLowerCase();
  } catch {
    pathname = normalized;
  }

  const isDriveHost = host.includes("drive.google.com") || host.includes("drive.usercontent.google.com");
  if (isDriveHost) {
    const isDirectDriveLink =
      pathname.startsWith("/uc") ||
      pathname.includes("/download") ||
      /(?:^|[?&])export=download(?:&|$)/.test(search) ||
      /(?:^|[?&])confirm=/.test(search);

    return isDirectDriveLink ? "direct" : "google_drive";
  }

  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }

  if (sourceType === "google_drive") return "google_drive";
  if (sourceType === "youtube") return "youtube";

  // Some providers store video links as `embed` even when they are direct media endpoints.
  const looksLikeDirectFromHostOrPath =
    host.includes("googlevideo.com") ||
    host.includes("akamaized.net") ||
    host.includes("cloudfront.net") ||
    host.includes("bunnycdn") ||
    host.includes("wasabisys.com") ||
    host.includes("backblazeb2.com") ||
    host.includes("storage.googleapis.com") ||
    (host.includes("blogger.com") && pathname.startsWith("/video.g")) ||
    (host.includes("blogspot.com") && pathname.includes("videoplayback")) ||
    normalized.startsWith("/") ||
    /\.(mp4|m4v|webm|ogg|mov|m3u8|mpd|ts)(\?|#|$)/.test(normalized) ||
    /(?:^|[?&])(format|mime)=video/.test(search) ||
    /(?:^|[?&])type=video/.test(search);

  if (looksLikeDirectFromHostOrPath) {
    return "direct";
  }

  const nestedMedia = extractNestedMediaUrl(normalizedUrl);
  if (nestedMedia && nestedMedia !== normalizedUrl) {
    const nestedType = detectVideoSource(nestedMedia, sourceType);
    if (nestedType === "direct") return "direct";
    if (nestedType === "google_drive") return "google_drive";
  }

  if (sourceType === "direct") return "direct";
  if (sourceType === "embed") return "embed";

  if (/\/embed\//.test(pathname) || /(?:^|[?&])(embed|player)=/.test(search)) {
    return "embed";
  }

  return "embed";
}

export function toEmbeddableVideoUrl(
  url?: string | null,
  sourceType?: string | null,
) {
  if (!url) return "";

  const normalizedUrl = normalizePlaybackUrl(url);

  const source = detectVideoSource(normalizedUrl, sourceType);
  if (source === "google_drive") {
    const directMatch = normalizedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const queryMatch = normalizedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = directMatch?.[1] || queryMatch?.[1];
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : normalizedUrl;
  }

  if (source === "youtube") {
    const shortMatch = normalizedUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    const watchMatch = normalizedUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    const videoId = shortMatch?.[1] || watchMatch?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : normalizedUrl;
  }

  return normalizedUrl;
}
