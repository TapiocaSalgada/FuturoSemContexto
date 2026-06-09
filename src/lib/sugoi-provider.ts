const DEFAULT_SUGOI_BASE = "https://sugoi-api-chi.vercel.app";
const LEGACY_SUGOI_BASES = [
  "https://sugoiapi.vercel.app",
  "https://sugoi-api.vercel.app",
];

export type SugoiDatabaseAnimeResult = {
  id: string;
  malId?: number;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  synopsis?: string;
  coverImage?: string;
  bannerImage?: string;
  score?: number;
  status?: string;
  genres: string[];
  themes: string[];
  studios: string[];
  season?: string;
  year?: number;
  raw?: any;
};

export type SugoiEpisodeSource = {
  provider: string;
  isEmbed: boolean;
  url: string;
  raw?: any;
};

export function slugifySugoi(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function compact<T>(items: Array<T | null | undefined | false>) {
  return items.filter(Boolean) as T[];
}

function ensureBase(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

export function getSugoiBases() {
  const envBase = process.env.SUGOI_API_BASE?.trim();
  return compact([envBase, DEFAULT_SUGOI_BASE, ...LEGACY_SUGOI_BASES]).map(ensureBase);
}

async function fetchJson(url: string, timeoutMs = 12000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = (await res.text())?.trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function mapDatabaseResults(payload: any): SugoiDatabaseAnimeResult[] {
  const rows = Array.isArray(payload?.data?.results) ?payload.data.results : [];

  return rows
    .map((item: any, index: number) => {
      const title = String(item?.title || item?.title_english || item?.title_japanese || "").trim();
      if (!title) return null;

      const coverImage =
        String(
          item?.images?.cover ||
            item?.images?.jpg?.large_image_url ||
            item?.images?.jpg?.image_url ||
            item?.images?.webp?.large_image_url ||
            item?.images?.webp?.image_url ||
            "",
        ).trim() || undefined;

      const bannerImage =
        String(
          item?.images?.banner ||
            item?.images?.webp?.large_image_url ||
            item?.images?.jpg?.large_image_url ||
            "",
        ).trim() || coverImage;

      const genres = Array.isArray(item?.genres)
        ?item.genres.map((g: any) => (typeof g === "string" ?g : g?.name)).filter(Boolean)
        : [];
      const themes = Array.isArray(item?.themes)
        ?item.themes.map((g: any) => (typeof g === "string" ?g : g?.name)).filter(Boolean)
        : [];
      const studios = Array.isArray(item?.studios)
        ?item.studios.map((g: any) => (typeof g === "string" ?g : g?.name)).filter(Boolean)
        : [];

      return {
        id: String(item?.mal_id || item?.id || `${index}`),
        malId: Number.isFinite(Number(item?.mal_id)) ?Number(item.mal_id) : undefined,
        title,
        titleEnglish: String(item?.title_english || "").trim() || undefined,
        titleJapanese: String(item?.title_japanese || "").trim() || undefined,
        synopsis: String(item?.synopsis || "").trim() || undefined,
        coverImage,
        bannerImage: bannerImage || undefined,
        score: Number.isFinite(Number(item?.score)) ?Number(item.score) : undefined,
        status: String(item?.status || "").trim() || undefined,
        genres,
        themes,
        studios,
        season: String(item?.season || "").trim() || undefined,
        year: Number.isFinite(Number(item?.year)) ?Number(item.year) : undefined,
        raw: item,
      } as SugoiDatabaseAnimeResult;
    })
    .filter(Boolean) as SugoiDatabaseAnimeResult[];
}

export async function searchSugoiDatabaseAnime(query: string, limit = 12) {
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery.length < 2) return [] as SugoiDatabaseAnimeResult[];

  const safeLimit = Math.max(1, Math.min(40, Number(limit || 12)));
  const encoded = encodeURIComponent(normalizedQuery);

  for (const base of getSugoiBases()) {
    const payload = await fetchJson(
      `${base}/api/database/anime/search?q=${encoded}&limit=${safeLimit}`,
      12000,
    );
    if (!payload || payload?.error === true) continue;

    const mapped = mapDatabaseResults(payload);
    if (mapped.length > 0) {
      return mapped.slice(0, safeLimit);
    }
  }

  return [] as SugoiDatabaseAnimeResult[];
}

export async function fetchSugoiEpisodeSources(slug: string, season: number, episode: number) {
  const normalizedSlug = slugifySugoi(String(slug || ""));
  if (!normalizedSlug) return [] as SugoiEpisodeSource[];

  const safeSeason = Number.isFinite(Number(season)) && Number(season) > 0 ?Math.floor(Number(season)) : 1;
  const safeEpisode = Number.isFinite(Number(episode)) && Number(episode) > 0 ?Math.floor(Number(episode)) : 1;
  const encodedSlug = encodeURIComponent(normalizedSlug);
  const encodedSeason = encodeURIComponent(String(safeSeason));
  const encodedEpisode = encodeURIComponent(String(safeEpisode));
  const paths = [
    `/api/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
  ];

  for (const base of getSugoiBases()) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`, 15000);
      if (!payload || (payload?.error && !payload?.data)) continue;

      const providers = Array.isArray(payload?.data) ?payload.data : [];
      const output: SugoiEpisodeSource[] = [];
      const seen = new Set<string>();

      for (const provider of providers) {
        const providerName = String(
          provider?.name || provider?.slug || provider?.provider || "sugoi",
        ).trim();
        const episodes = Array.isArray(provider?.episodes) ?provider.episodes : [];
        for (const item of episodes) {
          const url = String(item?.episode || item?.url || item?.link || "").trim();
          if (!url.startsWith("http")) continue;
          if (seen.has(url)) continue;
          seen.add(url);
          output.push({
            provider: providerName,
            isEmbed: Boolean(provider?.is_embed),
            url,
            raw: item,
          });
        }
      }

      if (output.length > 0) {
        return output;
      }
    }
  }

  return [] as SugoiEpisodeSource[];
}
