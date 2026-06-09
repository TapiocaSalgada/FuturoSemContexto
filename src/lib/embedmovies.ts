export const DEFAULT_EMBEDMOVIES_BASE_URL = "https://cdn-embed.com";

const BUILTIN_ALLOWED_HOSTS = new Set(["cdn-embed.com", "myembed.biz"]);

export type EmbedMoviesIdType = "tmdb" | "imdb";
export type EmbedMoviesMediaType = "movie" | "serie" | "anime";

export type EmbedPlaybackInput = {
  mediaType?: string | null;
  externalProvider?: string | null;
  externalId?: string | null;
  externalIdType?: string | null;
  season?: number | null;
  episode?: number | null;
};

export function isEmbedMoviesProvider(value?: string | null) {
  return String(value || "").trim().toLowerCase() === "embedmovies";
}

export function normalizeEmbedMoviesBaseUrl(input?: string | null) {
  const raw = String(input || process.env.EMBEDMOVIES_BASE_URL || DEFAULT_EMBEDMOVIES_BASE_URL).trim();
  const fallback = DEFAULT_EMBEDMOVIES_BASE_URL;

  try {
    const parsed = new URL(raw || fallback);
    parsed.protocol = "https:";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";

    const configuredHost = new URL(process.env.EMBEDMOVIES_BASE_URL || fallback).hostname.toLowerCase();
    const allowedHosts = new Set(Array.from(BUILTIN_ALLOWED_HOSTS).concat(configuredHost).filter(Boolean));
    const host = parsed.hostname.toLowerCase();
    if (!allowedHosts.has(host)) return fallback;

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function normalizeExternalIdType(id?: string | null, explicit?: string | null): EmbedMoviesIdType | "" {
  const requested = String(explicit || "").trim().toLowerCase();
  if (requested === "tmdb" || requested === "imdb") return requested;

  const value = String(id || "").trim();
  if (/^\d+$/.test(value)) return "tmdb";
  if (/^tt\d+$/i.test(value)) return "imdb";
  return "";
}

export function isValidEmbedMoviesId(id?: string | null, idType?: string | null) {
  const value = String(id || "").trim();
  const type = normalizeExternalIdType(value, idType);
  if (type === "tmdb") return /^\d+$/.test(value);
  if (type === "imdb") return /^tt\d+$/i.test(value);
  return false;
}

function cleanExternalId(id: string) {
  return encodeURIComponent(String(id || "").trim());
}

function ensurePositiveNumber(value?: number | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function buildEmbedMoviesMovieUrl(params: { id: string; baseUrl?: string | null }) {
  return `${normalizeEmbedMoviesBaseUrl(params.baseUrl)}/filme/${cleanExternalId(params.id)}`;
}

export function buildEmbedMoviesSeriesUrl(params: { id: string; baseUrl?: string | null }) {
  return `${normalizeEmbedMoviesBaseUrl(params.baseUrl)}/serie/${cleanExternalId(params.id)}`;
}

export function buildEmbedMoviesEpisodeUrl(params: {
  id: string;
  season: number;
  episode: number;
  baseUrl?: string | null;
}) {
  const season = ensurePositiveNumber(params.season);
  const episode = ensurePositiveNumber(params.episode);
  if (!season || !episode) return "";
  return `${buildEmbedMoviesSeriesUrl(params)}/${season}/${episode}`;
}

export function getEmbedUrlForPlayback(input: EmbedPlaybackInput) {
  if (!isEmbedMoviesProvider(input.externalProvider)) return "";

  const id = String(input.externalId || "").trim();
  if (!isValidEmbedMoviesId(id, input.externalIdType)) return "";

  const mediaType = String(input.mediaType || "").trim().toLowerCase();
  if (mediaType === "movie" || mediaType === "filme") {
    return buildEmbedMoviesMovieUrl({ id });
  }

  const season = ensurePositiveNumber(input.season);
  const episode = ensurePositiveNumber(input.episode);
  if (season && episode) {
    return buildEmbedMoviesEpisodeUrl({ id, season, episode });
  }

  return buildEmbedMoviesSeriesUrl({ id });
}
