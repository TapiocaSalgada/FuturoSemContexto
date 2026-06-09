import { buildImageCandidates } from "@/lib/image-quality";

const DEFAULT_ZENSHIN_BASES = [
  "https://zenshin-supabase-api.onrender.com",
  "https://zenshin-supabase-api-myig.onrender.com",
];

type ZenshinIdKey = "mal_id" | "anilist_id" | "thetvdb_id" | "anidb_id";

export type ZenshinEpisodePayload = {
  episode?: string | number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  image?: string | null;
  tvdbId?: number | null;
  [key: string]: unknown;
};

export type ZenshinMappingPayload = {
  mainTitle?: string | null;
  title?: Record<string, string | null> | null;
  date?: { startDate?: string | null; endDate?: string | null } | null;
  episodes?: Record<string, ZenshinEpisodePayload> | null;
  mappings?: Record<string, unknown> | null;
};

export type ZenshinArtwork = {
  coverImage?: string;
  bannerImage?: string;
  episodeImages: string[];
  episodeImagesByNumber: Record<number, string>;
  tmdbCoverImage?: string;
  tmdbBannerImage?: string;
  anilistCoverImage?: string;
  anilistBannerImage?: string;
  jikanCoverImage?: string;
  jikanBannerImage?: string;
};

type ZenshinLookupInput = {
  malId?: number | string | null;
  anilistId?: number | string | null;
  thetvdbId?: number | string | null;
  anidbId?: number | string | null;
};

function cleanBase(value: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function asPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;
  return Math.floor(parsed);
}

function normalizeImageUrl(value: unknown, mode: "card" | "banner" = "banner") {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  return buildImageCandidates(raw, { mode })[0] || raw;
}

function isSameImage(a: string, b: string) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  if (left === right) return true;

  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return (
      leftUrl.hostname.toLowerCase() === rightUrl.hostname.toLowerCase() &&
      leftUrl.pathname === rightUrl.pathname
    );
  } catch {
    return false;
  }
}

function firstImage(list: string[]) {
  for (const item of list) {
    const normalized = String(item || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function firstDistinctImage(list: string[], avoid: string[]) {
  for (const item of list) {
    const candidate = String(item || "").trim();
    if (!candidate) continue;
    if (avoid.some((value) => isSameImage(candidate, value))) continue;
    return candidate;
  }
  return "";
}

function buildLookupPairs(input: ZenshinLookupInput): Array<{ key: ZenshinIdKey; value: number }> {
  const entries: Array<{ key: ZenshinIdKey; value: number }> = [
    { key: "mal_id", value: asPositiveInt(input.malId) },
    { key: "anilist_id", value: asPositiveInt(input.anilistId) },
    { key: "thetvdb_id", value: asPositiveInt(input.thetvdbId) },
    { key: "anidb_id", value: asPositiveInt(input.anidbId) },
  ];

  return entries.filter((entry) => entry.value > 0);
}

async function fetchJson(url: string, timeoutMs = 12000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const text = (await response.text())?.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchTmdbArtworkById(tmdbId: number, typeHint: string | null | undefined) {
  const apiKey = String(process.env.TMDB_API_KEY || "").trim();
  if (!apiKey || tmdbId <= 0) return { coverImage: "", bannerImage: "" };

  const normalizedHint = String(typeHint || "").toLowerCase();
  const order = normalizedHint === "movie" ?["movie", "tv"] : ["tv", "movie"];

  for (const mediaType of order) {
    const endpoint = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`);
    endpoint.searchParams.set("api_key", apiKey);
    endpoint.searchParams.set("language", "pt-BR");
    const payload = await fetchJson(endpoint.toString(), 10000);
    if (!payload || typeof payload !== "object") continue;

    const posterPath = String((payload as any)?.poster_path || "").trim();
    const backdropPath = String((payload as any)?.backdrop_path || "").trim();

    const coverImage = posterPath
      ?normalizeImageUrl(`https://image.tmdb.org/t/p/w780${posterPath}`, "card")
      : "";
    const bannerImage = backdropPath
      ?normalizeImageUrl(`https://image.tmdb.org/t/p/w1280${backdropPath}`, "banner")
      : "";

    if (coverImage || bannerImage) {
      return { coverImage, bannerImage };
    }
  }

  return { coverImage: "", bannerImage: "" };
}

async function fetchAniListArtworkById(anilistId: number) {
  if (anilistId <= 0) return { coverImage: "", bannerImage: "" };

  try {
    const payload = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              bannerImage
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `,
        variables: { id: anilistId },
      }),
      cache: "no-store",
    });

    if (!payload.ok) return { coverImage: "", bannerImage: "" };
    const json = await payload.json().catch(() => null);
    const media = json?.data?.Media;
    if (!media) return { coverImage: "", bannerImage: "" };

    const coverImage = normalizeImageUrl(
      media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium,
      "card",
    );
    const bannerImage = normalizeImageUrl(media?.bannerImage, "banner");

    return { coverImage, bannerImage };
  } catch {
    return { coverImage: "", bannerImage: "" };
  }
}

async function fetchJikanArtworkByMalId(malId: number) {
  if (malId <= 0) return { coverImage: "", bannerImage: "" };
  const payload = await fetchJson(`https://api.jikan.moe/v4/anime/${malId}/full`, 10000);
  const data = (payload as any)?.data || null;
  if (!data) return { coverImage: "", bannerImage: "" };

  const coverImage = normalizeImageUrl(
    data?.images?.jpg?.large_image_url ||
      data?.images?.webp?.large_image_url ||
      data?.images?.jpg?.image_url ||
      data?.images?.webp?.image_url,
    "card",
  );

  const bannerImage = normalizeImageUrl(
    data?.trailer?.images?.maximum_image_url ||
      data?.trailer?.images?.large_image_url ||
      data?.trailer?.images?.medium_image_url,
    "banner",
  );

  return { coverImage, bannerImage };
}

export function getZenshinBases() {
  const envBase = cleanBase(process.env.ZENSHIN_API_BASE || "");
  const list = [envBase, ...DEFAULT_ZENSHIN_BASES.map(cleanBase)].filter(Boolean);
  return Array.from(new Set(list));
}

export async function fetchZenshinMapping(input: ZenshinLookupInput): Promise<ZenshinMappingPayload | null> {
  const pairs = buildLookupPairs(input);
  if (!pairs.length) return null;

  const bases = getZenshinBases();
  for (const pair of pairs) {
    for (const base of bases) {
      const endpoint = new URL(`${base}/mappings`);
      endpoint.searchParams.set(pair.key, String(pair.value));
      const payload = await fetchJson(endpoint.toString(), 12000);
      if (!payload || typeof payload !== "object") continue;
      if ((payload as any)?.error) continue;
      if (!(payload as any)?.episodes && !(payload as any)?.mappings && !(payload as any)?.title) continue;
      return payload as ZenshinMappingPayload;
    }
  }

  return null;
}

export function extractZenshinEpisodeImages(
  mapping: ZenshinMappingPayload | null | undefined,
): { episodeImagesByNumber: Record<number, string>; episodeImages: string[] } {
  const episodeImagesByNumber: Record<number, string> = {};
  const episodeImages: string[] = [];

  const episodes = mapping?.episodes && typeof mapping.episodes === "object" ?mapping.episodes : {};
  for (const [key, payload] of Object.entries(episodes || {})) {
    const image = normalizeImageUrl((payload as ZenshinEpisodePayload)?.image, "banner");
    if (!image) continue;

    const byKey = asPositiveInt(key);
    const byPayloadNumber = asPositiveInt((payload as ZenshinEpisodePayload)?.episodeNumber);
    const byPayloadEpisode = asPositiveInt((payload as ZenshinEpisodePayload)?.episode);
    const number = byPayloadNumber || byPayloadEpisode || byKey;
    if (number > 0 && !episodeImagesByNumber[number]) {
      episodeImagesByNumber[number] = image;
    }
    if (!episodeImages.includes(image)) {
      episodeImages.push(image);
    }
  }

  return { episodeImagesByNumber, episodeImages };
}

export function pickEpisodePreviewFromPool(pool: string[], episodeNumber: number, seed = "") {
  if (!pool.length) return "";
  const safeEpisode = Math.max(1, Math.floor(Number(episodeNumber) || 1));
  let hash = safeEpisode * 131;
  const seedText = String(seed || "");
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 33 + seedText.charCodeAt(index)) >>> 0;
  }
  return pool[hash % pool.length] || pool[0] || "";
}

export async function resolveZenshinArtwork(
  mapping: ZenshinMappingPayload | null | undefined,
): Promise<ZenshinArtwork> {
  const { episodeImagesByNumber, episodeImages } = extractZenshinEpisodeImages(mapping);

  const tmdbId = asPositiveInt(mapping?.mappings?.themoviedb_id);
  const tmdbType = String(mapping?.mappings?.type || "").trim();
  const anilistId = asPositiveInt(mapping?.mappings?.anilist_id);
  const malId = asPositiveInt(mapping?.mappings?.mal_id);

  const [tmdbArtwork, anilistArtwork, jikanArtwork] = await Promise.all([
    tmdbId > 0 ?fetchTmdbArtworkById(tmdbId, tmdbType) : Promise.resolve({ coverImage: "", bannerImage: "" }),
    anilistId > 0 ?fetchAniListArtworkById(anilistId) : Promise.resolve({ coverImage: "", bannerImage: "" }),
    malId > 0 ?fetchJikanArtworkByMalId(malId) : Promise.resolve({ coverImage: "", bannerImage: "" }),
  ]);

  const coverImage = firstImage([tmdbArtwork.coverImage, anilistArtwork.coverImage, jikanArtwork.coverImage]);

  const bannerImage = firstDistinctImage(
    [tmdbArtwork.bannerImage, anilistArtwork.bannerImage, jikanArtwork.bannerImage],
    [coverImage],
  );

  return {
    coverImage: coverImage || undefined,
    bannerImage: bannerImage || undefined,
    episodeImagesByNumber,
    episodeImages,
    tmdbCoverImage: tmdbArtwork.coverImage || undefined,
    tmdbBannerImage: tmdbArtwork.bannerImage || undefined,
    anilistCoverImage: anilistArtwork.coverImage || undefined,
    anilistBannerImage: anilistArtwork.bannerImage || undefined,
    jikanCoverImage: jikanArtwork.coverImage || undefined,
    jikanBannerImage: jikanArtwork.bannerImage || undefined,
  };
}
