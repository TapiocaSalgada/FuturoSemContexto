import { buildImageCandidates } from "@/lib/image-quality";
import { findAnimeMediaOptionsByTitle } from "@/lib/mal";
import { searchSugoiDatabaseAnime } from "@/lib/sugoi-provider";
import { fetchZenshinMapping, getZenshinBases, resolveZenshinArtwork } from "@/lib/zenshin";

export type AdminAnimeMetadataOption = {
  source: "mal" | "find_my_anime" | "sugoi_db" | "zenshin_api" | "anilist";
  sourceUrl?: string;
  malId?: number;
  malUrl?: string;
  matchedTitle: string;
  coverImage?: string;
  bannerImage?: string;
  description?: string;
  categories: string[];
  score?: number;
};

type FindMyAnimeEntry = {
  title?: string;
  picture?: string;
  thumbnail?: string;
  tags?: string[];
  synonyms?: string[];
  studios?: string[];
  producers?: string[];
  type?: string;
  episodes?: number;
  status?: string;
  animeSeason?: { season?: string; year?: number };
  score?: { arithmeticMean?: number };
  sources?: string[];
};

function asCleanText(value: unknown) {
  return String(value || "").trim();
}

function estimatePortugueseScore(value: string) {
  const text = asCleanText(value).toLowerCase();
  if (!text) return 0;

  let score = 0;
  const hints = [
    "episodio",
    "temporada",
    "sinopse",
    "personagem",
    "historia",
    "acao",
    "aventura",
    "drama",
    "romance",
    "comedia",
    "dublado",
    "legendado",
    "lancamento",
    "exibicao",
  ];

  for (const hint of hints) {
    if (text.includes(hint)) {
      score += 1;
    }
  }

  if (/[ãõáéíóúàâêôç]/i.test(text)) {
    score += 2;
  }

  return score;
}

function looksEnglishDominant(value: string) {
  const text = asCleanText(value).toLowerCase();
  if (!text) return false;

  const englishHints = [
    "the ",
    " and ",
    " with ",
    "after ",
    "before ",
    "story",
    "episode",
    "season",
    "adventure",
    "school",
    "battle",
  ];

  let hits = 0;
  for (const hint of englishHints) {
    if (text.includes(hint)) hits += 1;
  }

  return hits >= 2;
}

function toImage(value: unknown) {
  const raw = asCleanText(value);
  if (!raw) return "";
  return buildImageCandidates(raw)[0] || raw;
}

function stripHtml(value: unknown) {
  const raw = asCleanText(value);
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeStatus(value: string) {
  const current = value.toUpperCase();
  if (current === "FINISHED") return "finalizado";
  if (current === "ONGOING") return "em exibicao";
  if (current === "UPCOMING") return "em breve";
  return "indefinido";
}

function normalizeType(value: string) {
  const current = value.toUpperCase();
  if (current === "TV") return "TV";
  if (current === "MOVIE") return "Filme";
  if (current === "OVA") return "OVA";
  if (current === "ONA") return "ONA";
  if (current === "SPECIAL") return "Especial";
  return "Indefinido";
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  action: "acao",
  adventure: "aventura",
  "adventure comedy": "aventura comedia",
  comedy: "comedia",
  romance: "romance",
  drama: "drama",
  fantasy: "fantasia",
  "sci-fi": "ficcao cientifica",
  "science fiction": "ficcao cientifica",
  supernatural: "sobrenatural",
  mystery: "misterio",
  psychological: "psicologico",
  thriller: "suspense",
  horror: "terror",
  sports: "esportes",
  school: "escolar",
  "slice of life": "vida cotidiana",
  historical: "histórico",
  military: "militar",
  music: "musical",
  shounen: "shounen",
  shoujo: "shoujo",
  seinen: "seinen",
  josei: "josei",
  ecchi: "ecchi",
  mecha: "mecha",
  isekai: "isekai",
};

function toTitleCase(value: string) {
  const clean = asCleanText(value);
  if (!clean) return "";
  return clean
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCategoryLabel(value: string) {
  const clean = asCleanText(value);
  if (!clean) return "";

  const normalizedKey = clean
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const translated = CATEGORY_TRANSLATIONS[normalizedKey];
  if (translated) {
    return toTitleCase(translated);
  }

  return toTitleCase(normalizedKey);
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeCategoryLabel(value)).filter(Boolean)),
  );
}

function buildFindMyAnimeDescription(entry: FindMyAnimeEntry) {
  const pieces: string[] = [];
  const normalizedType = normalizeType(asCleanText(entry.type));
  const normalizedStatus = normalizeStatus(asCleanText(entry.status));
  const season = asCleanText(entry.animeSeason?.season);
  const year = Number(entry.animeSeason?.year || 0);
  const episodes = Number(entry.episodes || 0);

  pieces.push(`Tipo: ${normalizedType}`);
  pieces.push(`Status: ${normalizedStatus}`);

  if (year > 0) {
    const seasonal = season && season !== "UNDEFINED" ?`${season.toLowerCase()} ${year}` : String(year);
    pieces.push(`Estreia: ${seasonal}`);
  }

  if (episodes > 0) {
    pieces.push(`Episódios: ${episodes}`);
  }

  return pieces.join(". ");
}

function computeMatchScore(query: string, option: AdminAnimeMetadataOption) {
  const normalizedQuery = asCleanText(query).toLowerCase();
  const normalizedTitle = asCleanText(option.matchedTitle).toLowerCase();
  const description = asCleanText(option.description);
  const portugueseScore = estimatePortugueseScore(description);
  let score = 0;

  if (normalizedTitle === normalizedQuery) score += 140;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 90;
  else if (normalizedTitle.includes(normalizedQuery)) score += 60;

  if (description) {
    score += 10;
    score += portugueseScore * 3;
    if (looksEnglishDominant(description) && portugueseScore === 0) {
      score -= 8;
    }
  }
  if (option.categories.length) score += 8;
  if (option.coverImage) score += 10;
  if (option.bannerImage) score += 10;
  if (typeof option.score === "number") score += Math.max(0, Math.min(option.score, 10));
  if (option.source === "find_my_anime") score += 10;
  if (option.source === "zenshin_api") score += 14;
  if (option.source === "mal") score += 2;

  return score;
}

function mapMalOptions(query: string, limit: number): Promise<AdminAnimeMetadataOption[]> {
  return findAnimeMediaOptionsByTitle(query, limit).then((rows) =>
    rows.map((item) => {
      const coverImage = toImage(item.imageUrl);
      const bannerImage = toImage(item.trailerImageUrl || item.imageUrl);

      return {
        source: "mal" as const,
        sourceUrl: asCleanText(item.url) || undefined,
        malId: item.malId,
        malUrl: asCleanText(item.url) || undefined,
        matchedTitle: asCleanText(item.title) || "Sem título",
        coverImage: coverImage || undefined,
        bannerImage: bannerImage || coverImage || undefined,
        description: asCleanText(item.synopsis) || undefined,
        categories: unique([
          ...(item.genres || []),
          ...(item.themes || []),
          ...(item.demographics || []),
        ]),
        score: item.score,
      };
    }),
  );
}

async function mapSugoiDatabaseOptions(
  query: string,
  limit: number,
): Promise<AdminAnimeMetadataOption[]> {
  const rows = await searchSugoiDatabaseAnime(query, Math.max(limit * 2, 20));

  return rows.map((item) => {
    const coverImage = toImage(item.coverImage);
    const bannerImage = toImage(item.bannerImage || item.coverImage);

    return {
      source: "sugoi_db" as const,
      sourceUrl: item.malId ?`https://myanimelist.net/anime/${item.malId}` : undefined,
      malId: item.malId,
      malUrl: item.malId ?`https://myanimelist.net/anime/${item.malId}` : undefined,
      matchedTitle: asCleanText(item.title) || "Sem título",
      coverImage: coverImage || undefined,
      bannerImage: bannerImage || coverImage || undefined,
      description: asCleanText(item.synopsis) || undefined,
      categories: unique([...(item.genres || []), ...(item.themes || []), ...(item.studios || [])]),
      score: item.score,
    };
  });
}

async function mapFindMyAnimeOptions(query: string, limit: number): Promise<AdminAnimeMetadataOption[]> {
  const baseUrl = asCleanText(process.env.FIND_MY_ANIME_API_URL) || "https://find-my-anime.dtimur.de/api";
  const endpoint = new URL(baseUrl);
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("includeAdult", "false");
  endpoint.searchParams.set("collectionConsent", "false");

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 21600 },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    return payload.slice(0, Math.max(limit * 2, 24)).map((entry: FindMyAnimeEntry) => {
      const categories = unique([
        ...(entry.tags || []),
        ...(entry.studios || []),
        ...(entry.producers || []),
      ]);
      const coverImage = toImage(entry.picture || entry.thumbnail);
      const bannerImage = toImage(entry.picture || coverImage);
      const sourceUrl = asCleanText(entry.sources?.[0]) || undefined;

      return {
        source: "find_my_anime" as const,
        sourceUrl,
        matchedTitle: asCleanText(entry.title) || "Sem título",
        coverImage: coverImage || undefined,
        bannerImage: bannerImage || coverImage || undefined,
        description: buildFindMyAnimeDescription(entry) || undefined,
        categories,
        score:
          typeof entry.score?.arithmeticMean === "number"
            ?entry.score.arithmeticMean
            : undefined,
      };
    });
  } catch {
    return [];
  }
}

async function mapAniListOptions(
  query: string,
  limit: number,
): Promise<AdminAnimeMetadataOption[]> {
  const safeQuery = asCleanText(query);
  if (safeQuery.length < 2) return [];

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query ($search: String, $perPage: Int) {
            Page(page: 1, perPage: $perPage) {
              media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
                id
                idMal
                siteUrl
                title {
                  romaji
                  english
                  native
                }
                description(asHtml: false)
                genres
                averageScore
                status
                episodes
                coverImage {
                  extraLarge
                  large
                  medium
                }
                bannerImage
              }
            }
          }
        `,
        variables: { search: safeQuery, perPage: Math.max(1, Math.min(20, limit * 2)) },
      }),
      cache: "no-store",
    });

    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    const media = Array.isArray(payload?.data?.Page?.media) ?payload.data.Page.media : [];
    if (!media.length) return [];

    return media.map((item: any) => {
      const title =
        asCleanText(item?.title?.romaji) ||
        asCleanText(item?.title?.english) ||
        asCleanText(item?.title?.native) ||
        "Sem título";
      const coverImage = toImage(
        item?.coverImage?.extraLarge || item?.coverImage?.large || item?.coverImage?.medium,
      );
      const bannerImage = toImage(item?.bannerImage);
      const status = normalizeStatus(asCleanText(item?.status));
      const episodes = Number(item?.episodes || 0);
      const score = Number(item?.averageScore || 0);
      const genres = Array.isArray(item?.genres) ?item.genres : [];

      const descriptionParts = [
        stripHtml(item?.description),
        status && status !== "indefinido" ?`Status: ${status}` : "",
        episodes > 0 ?`Episódios: ${episodes}` : "",
      ].filter(Boolean);

      return {
        source: "anilist" as const,
        sourceUrl: asCleanText(item?.siteUrl) || undefined,
        malId: Number(item?.idMal || 0) || undefined,
        malUrl: Number(item?.idMal || 0) ?`https://myanimelist.net/anime/${Number(item.idMal)}` : undefined,
        matchedTitle: title,
        coverImage: coverImage || undefined,
        bannerImage: bannerImage || undefined,
        description: descriptionParts.join(". ") || undefined,
        categories: unique([...genres, "AniList"]),
        score: score > 0 ?Number((score / 10).toFixed(1)) : undefined,
      } satisfies AdminAnimeMetadataOption;
    });
  } catch {
    return [];
  }
}

async function mapZenshinOptions(
  query: string,
  limit: number,
  seedOptions: AdminAnimeMetadataOption[],
): Promise<AdminAnimeMetadataOption[]> {
  const malCandidates = Array.from(
    new Set(
      seedOptions
        .map((option) => Number(option.malId || 0))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ).slice(0, Math.max(2, Math.min(6, limit)));

  if (!malCandidates.length) return [];

  const zenshinBase = getZenshinBases()[0] || "";

  const rows = await Promise.all(
    malCandidates.map(async (malId) => {
      const mapping = await fetchZenshinMapping({ malId });
      if (!mapping) return null;

      const artwork = await resolveZenshinArtwork(mapping);
      if (!artwork.coverImage && !artwork.bannerImage && !artwork.episodeImages.length) {
        return null;
      }

      const mappingTitle = {
        main: asCleanText(mapping?.title?.main),
        en: asCleanText(mapping?.title?.en),
        ja: asCleanText(mapping?.title?.ja),
      };
      const matchedTitle =
        mappingTitle.main ||
        mappingTitle.en ||
        asCleanText(mapping?.mainTitle) ||
        `Anime ${malId}`;

      const rawMappings = (mapping?.mappings || {}) as Record<string, unknown>;
      const type = asCleanText(rawMappings.type);
      const anilistId = Number(rawMappings.anilist_id || 0) || undefined;
      const tvdbId = Number(rawMappings.tvdb_id || rawMappings.thetvdb_id || 0) || undefined;
      const startDate = asCleanText(mapping?.date?.startDate);
      const endDate = asCleanText(mapping?.date?.endDate);

      const descriptionParts = [
        "Artwork via Zenshin API",
        startDate ?`Estreia: ${startDate}` : "",
        endDate ?`Fim: ${endDate}` : "",
        anilistId ?`AniList: ${anilistId}` : "",
        tvdbId ?`TVDB: ${tvdbId}` : "",
      ].filter(Boolean);

      const categories = unique([
        type || "",
        "Zenshin",
        artwork.tmdbBannerImage ?"TMDB Banner" : "",
        artwork.episodeImages.length > 0 ?"Preview de episódios" : "",
      ]);

      return {
        source: "zenshin_api" as const,
        sourceUrl: zenshinBase ?`${zenshinBase}/mappings?mal_id=${malId}` : undefined,
        malId,
        malUrl: `https://myanimelist.net/anime/${malId}`,
        matchedTitle,
        coverImage: artwork.coverImage,
        bannerImage: artwork.bannerImage,
        description: descriptionParts.join(". "),
        categories,
        score: 9.4,
      } satisfies AdminAnimeMetadataOption;
    }),
  );

  return rows.filter(Boolean) as AdminAnimeMetadataOption[];
}

export async function searchAnimeMetadataOptions(query: string, limit = 12) {
  const normalizedQuery = asCleanText(query);
  const safeLimit = Math.max(1, Math.min(30, Number(limit || 12)));
  if (normalizedQuery.length < 2) return [] as AdminAnimeMetadataOption[];

  const [sugoiDbOptions, malOptions, anilistOptions, findMyAnimeOptions] = await Promise.all([
    mapSugoiDatabaseOptions(normalizedQuery, safeLimit),
    mapMalOptions(normalizedQuery, safeLimit),
    mapAniListOptions(normalizedQuery, safeLimit),
    mapFindMyAnimeOptions(normalizedQuery, safeLimit),
  ]);

  const zenshinOptions = await mapZenshinOptions(
    normalizedQuery,
    safeLimit,
    [...malOptions, ...sugoiDbOptions],
  );

  const merged = [
    ...zenshinOptions,
    ...sugoiDbOptions,
    ...anilistOptions,
    ...malOptions,
    ...findMyAnimeOptions,
  ]
    .map((option) => ({
      ...option,
      __matchScore: computeMatchScore(normalizedQuery, option),
      __ptScore: estimatePortugueseScore(asCleanText(option.description)),
    }))
    .sort((a, b) => b.__matchScore - a.__matchScore);

  const deduped = new Map<string, (typeof merged)[number]>();
  for (const option of merged) {
    const key = asCleanText(option.matchedTitle).toLowerCase();
    if (!key) continue;
    if (!deduped.has(key)) {
      deduped.set(key, option);
      continue;
    }

    const current = deduped.get(key)!;
    if (
      option.__matchScore > current.__matchScore ||
      (option.__matchScore === current.__matchScore && option.__ptScore > current.__ptScore)
    ) {
      deduped.set(key, option);
    }
  }

  return Array.from(deduped.values())
    .slice(0, safeLimit)
    .map(({ __matchScore, __ptScore, ...option }) => option);
}
