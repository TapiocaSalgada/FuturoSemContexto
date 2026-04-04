/**
 * MAL / Jikan API Integration — Kandaraku v2
 *
 * Uses Jikan API v4 (free, no auth) for searching and fetching anime metadata
 * from MyAnimeList. Enhanced with extended data retrieval.
 *
 * Rate limit: 3 requests/second, 60 requests/minute
 */

const JIKAN_BASE = "https://api.jikan.moe/v4";

// Retry helper with exponential backoff for rate limiting
async function jikanFetch(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 3600 },
      });

      if (res.status === 429) {
        // Rate limited — wait and retry
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Jikan API error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error("Jikan API: all retries exhausted");
}

// ── Types ──────────────────────────────────────────────

export type AnimeMediaOption = {
  malId: number;
  title: string;
  titleJapanese?: string;
  titleEnglish?: string;
  imageUrl?: string;
  synopsis?: string;
  score?: number;
  scoredBy?: number;
  episodes?: number;
  status?: string;
  type?: string; // TV, OVA, Movie, Special, ONA
  year?: number;
  season?: string;
  airedFrom?: string;
  airedTo?: string;
  studios?: string[];
  genres?: string[];
  themes?: string[];
  demographics?: string[];
  trailerUrl?: string;
  trailerImageUrl?: string;
  rating?: string; // PG-13, R, etc
  source?: string; // Manga, Light Novel, etc
  duration?: string;
  rank?: number;
  popularity?: number;
  members?: number;
  url?: string;
};

export type AnimeFullDetails = AnimeMediaOption & {
  background?: string;
  relations?: { relation: string; entries: { mal_id: number; name: string; type: string }[] }[];
  recommendations?: { mal_id: number; title: string; imageUrl?: string }[];
  streaming?: { name: string; url: string }[];
};

export type MangaMediaOption = {
  malId: number;
  title: string;
  titleJapanese?: string;
  titleEnglish?: string;
  imageUrl?: string;
  synopsis?: string;
  score?: number;
  scoredBy?: number;
  chapters?: number;
  volumes?: number;
  status?: string;
  type?: string;
  publishing?: boolean;
  publishedFrom?: string;
  publishedTo?: string;
  year?: number;
  genres?: string[];
  themes?: string[];
  demographics?: string[];
  rank?: number;
  popularity?: number;
  members?: number;
  url?: string;
};

// ── Mappers ────────────────────────────────────────────

function mapAnimeData(item: any): AnimeMediaOption {
  return {
    malId: item.mal_id,
    title: item.title || item.title_english || "Sem título",
    titleJapanese: item.title_japanese || undefined,
    titleEnglish: item.title_english || undefined,
    imageUrl:
      item.images?.jpg?.large_image_url ||
      item.images?.jpg?.image_url ||
      item.images?.webp?.large_image_url ||
      undefined,
    synopsis: item.synopsis || undefined,
    score: item.score || undefined,
    scoredBy: item.scored_by || undefined,
    episodes: item.episodes || undefined,
    status: item.status || undefined,
    type: item.type || undefined,
    year: item.year || (item.aired?.prop?.from?.year) || undefined,
    season: item.season || undefined,
    airedFrom: item.aired?.from || undefined,
    airedTo: item.aired?.to || undefined,
    studios: (item.studios || []).map((s: any) => s.name).filter(Boolean),
    genres: (item.genres || []).map((g: any) => g.name).filter(Boolean),
    themes: (item.themes || []).map((t: any) => t.name).filter(Boolean),
    demographics: (item.demographics || []).map((d: any) => d.name).filter(Boolean),
    trailerUrl: item.trailer?.url || undefined,
    trailerImageUrl: item.trailer?.images?.maximum_image_url || item.trailer?.images?.large_image_url || undefined,
    rating: item.rating || undefined,
    source: item.source || undefined,
    duration: item.duration || undefined,
    rank: item.rank || undefined,
    popularity: item.popularity || undefined,
    members: item.members || undefined,
    url: item.url || undefined,
  };
}

function mapMangaData(item: any): MangaMediaOption {
  return {
    malId: item.mal_id,
    title: item.title || item.title_english || "Sem título",
    titleJapanese: item.title_japanese || undefined,
    titleEnglish: item.title_english || undefined,
    imageUrl:
      item.images?.jpg?.large_image_url ||
      item.images?.jpg?.image_url ||
      item.images?.webp?.large_image_url ||
      undefined,
    synopsis: item.synopsis || undefined,
    score: item.score || undefined,
    scoredBy: item.scored_by || undefined,
    chapters: item.chapters || undefined,
    volumes: item.volumes || undefined,
    status: item.status || undefined,
    type: item.type || undefined,
    publishing: item.publishing ?? undefined,
    publishedFrom: item.published?.from || undefined,
    publishedTo: item.published?.to || undefined,
    year: item.published?.prop?.from?.year || undefined,
    genres: (item.genres || []).map((g: any) => g.name).filter(Boolean),
    themes: (item.themes || []).map((t: any) => t.name).filter(Boolean),
    demographics: (item.demographics || []).map((d: any) => d.name).filter(Boolean),
    rank: item.rank || undefined,
    popularity: item.popularity || undefined,
    members: item.members || undefined,
    url: item.url || undefined,
  };
}

// ── Search Functions ───────────────────────────────────

/**
 * Search anime on MAL via Jikan
 */
export async function findAnimeMediaOptionsByTitle(
  title: string,
  limit = 10,
): Promise<AnimeMediaOption[]> {
  if (!title || !title.trim()) return [];

  try {
    const encoded = encodeURIComponent(title.trim());
    const data = await jikanFetch(
      `${JIKAN_BASE}/anime?q=${encoded}&limit=${limit}&sfw=true&order_by=score&sort=desc`,
    );

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map(mapAnimeData);
  } catch (err) {
    console.error("[MAL] Search error:", err);
    return [];
  }
}

export async function findMangaMediaOptionsByTitle(
  title: string,
  limit = 10,
): Promise<MangaMediaOption[]> {
  if (!title || !title.trim()) return [];

  try {
    const encoded = encodeURIComponent(title.trim());
    const data = await jikanFetch(
      `${JIKAN_BASE}/manga?q=${encoded}&limit=${limit}&sfw=true&order_by=score&sort=desc`,
    );

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map(mapMangaData);
  } catch (err) {
    console.error("[MAL] Manga search error:", err);
    return [];
  }
}

/**
 * Get a specific anime by title (best match)
 */
export async function findMalMetadataByTitle(
  title: string,
): Promise<AnimeMediaOption | null> {
  const results = await findAnimeMediaOptionsByTitle(title, 5);
  if (!results.length) return null;

  // Find exact or closest match
  const normalized = title.toLowerCase().trim();
  const exactMatch = results.find(
    (r) =>
      r.title.toLowerCase() === normalized ||
      r.titleEnglish?.toLowerCase() === normalized ||
      r.titleJapanese === title,
  );

  return exactMatch || results[0];
}

export async function findMangaMetadataByTitle(
  title: string,
): Promise<MangaMediaOption | null> {
  const results = await findMangaMediaOptionsByTitle(title, 5);
  if (!results.length) return null;

  const normalized = title.toLowerCase().trim();
  const exactMatch = results.find(
    (result) =>
      result.title.toLowerCase() === normalized ||
      result.titleEnglish?.toLowerCase() === normalized ||
      result.titleJapanese === title,
  );

  return exactMatch || results[0];
}

/**
 * Get full anime details by MAL ID
 */
export async function getAnimeDetailById(
  malId: number,
): Promise<AnimeFullDetails | null> {
  if (!malId || malId <= 0) return null;

  try {
    const data = await jikanFetch(
      `${JIKAN_BASE}/anime/${malId}/full`,
    );

    if (!data?.data) return null;

    const item = data.data;
    const base = mapAnimeData(item);

    return {
      ...base,
      background: item.background || undefined,
      relations: (item.relations || []).map((r: any) => ({
        relation: r.relation,
        entries: (r.entry || []).map((e: any) => ({
          mal_id: e.mal_id,
          name: e.name,
          type: e.type,
        })),
      })),
      recommendations: (item.recommendations || []).slice(0, 8).map((r: any) => ({
        mal_id: r.entry?.mal_id,
        title: r.entry?.title || "Unknown",
        imageUrl: r.entry?.images?.jpg?.large_image_url || r.entry?.images?.jpg?.image_url || undefined,
      })),
      streaming: (item.streaming || []).map((s: any) => ({
        name: s.name,
        url: s.url,
      })),
    };
  } catch (err) {
    console.error("[MAL] Detail fetch error for malId:", malId, err);
    return null;
  }
}

/**
 * Get top/trending anime from MAL
 */
export async function getTopAnime(
  filter: "airing" | "upcoming" | "bypopularity" | "favorite" = "airing",
  limit = 10,
): Promise<AnimeMediaOption[]> {
  try {
    const data = await jikanFetch(
      `${JIKAN_BASE}/top/anime?filter=${filter}&limit=${limit}&sfw=true`,
    );

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map(mapAnimeData);
  } catch (err) {
    console.error("[MAL] Top anime error:", err);
    return [];
  }
}

/**
 * Get seasonal anime
 */
export async function getSeasonalAnime(
  year?: number,
  season?: "winter" | "spring" | "summer" | "fall",
  limit = 20,
): Promise<AnimeMediaOption[]> {
  try {
    const now = new Date();
    const y = year || now.getFullYear();
    const s = season || ["winter", "spring", "summer", "fall"][Math.floor(now.getMonth() / 3)] as any;

    const data = await jikanFetch(
      `${JIKAN_BASE}/seasons/${y}/${s}?limit=${limit}&sfw=true`,
    );

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.map(mapAnimeData);
  } catch (err) {
    console.error("[MAL] Seasonal anime error:", err);
    return [];
  }
}

/**
 * Get anime recommendations based on a specific anime
 */
export async function getAnimeRecommendations(
  malId: number,
  limit = 8,
): Promise<{ mal_id: number; title: string; imageUrl?: string }[]> {
  if (!malId || malId <= 0) return [];

  try {
    const data = await jikanFetch(
      `${JIKAN_BASE}/anime/${malId}/recommendations`,
    );

    if (!data?.data || !Array.isArray(data.data)) return [];

    return data.data.slice(0, limit).map((r: any) => ({
      mal_id: r.entry?.mal_id,
      title: r.entry?.title || "Unknown",
      imageUrl: r.entry?.images?.jpg?.large_image_url || r.entry?.images?.jpg?.image_url || undefined,
    }));
  } catch (err) {
    console.error("[MAL] Recommendations error:", err);
    return [];
  }
}
