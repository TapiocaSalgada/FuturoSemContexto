export type WatchSource = {
  label?: string;
  url: string;
  type?: string;
  sourceType?: string;
  provider?: string;
  quality?: string | null;
  language?: string | null;
};

export type WatchPlaylistItem = {
  id: string;
  title: string;
  number: number;
  season?: number;
  href?: string;
};

export type WatchPayload = {
  anime?: { id: string; title: string; slug?: string | null; coverImage?: string | null; bannerImage?: string | null };
  episode?: { id: string; title: string; number: number; season?: number; description?: string | null; durationSec?: number | null };
  episodeId: string;
  videoToPlay: string;
  embedUrl?: string;
  sources?: WatchSource[];
  playlist?: WatchPlaylistItem[];
  nextEpisode?: WatchPlaylistItem | null;
  prevEpisode?: WatchPlaylistItem | null;
  history?: { progressSec?: number; progressSeconds?: number; completed?: boolean } | null;
  sourceType?: string;
  isDirectSource?: boolean;
};

export type PlayerStatus =
  | "idle"
  | "authorizing"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "seeking"
  | "ended"
  | "recoverable_error"
  | "fatal_error";

export function sourceUrl(payload: WatchPayload, index: number) {
  return payload.sources?.[index]?.url || payload.videoToPlay || payload.embedUrl || "";
}

export function sourceLabel(payload: WatchPayload, index: number) {
  const source = payload.sources?.[index];
  return source?.label || source?.provider || `Fonte ${index + 1}`;
}

export function isDirectSource(payload: WatchPayload, index: number) {
  const source = payload.sources?.[index];
  const kind = String(source?.type || payload.sourceType || "").toLowerCase();
  const declared = String(source?.sourceType || "").toLowerCase();
  const url = sourceUrl(payload, index).toLowerCase();
  if (kind === "direct" || declared === "hls" || declared === "dash" || declared === "mp4") return true;
  return url.includes(".m3u8") || url.includes(".mp4") || url.includes(".webm");
}

export function isHlsUrl(url: string) {
  return /\.m3u8(\?|$)/i.test(url);
}
