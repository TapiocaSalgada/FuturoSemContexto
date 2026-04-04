import { buildImageCandidates } from "@/lib/image-quality";
import { findAnimeMediaOptionsByTitle } from "@/lib/mal";

export type AdminAnimeMetadataOption = {
  source: "mal" | "find_my_anime";
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

function toImage(value: unknown) {
  const raw = asCleanText(value);
  if (!raw) return "";
  return buildImageCandidates(raw)[0] || raw;
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

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => asCleanText(value)).filter(Boolean)));
}

function buildFindMyAnimeDescription(entry: FindMyAnimeEntry, categories: string[]) {
  const pieces: string[] = [];
  const normalizedType = normalizeType(asCleanText(entry.type));
  const normalizedStatus = normalizeStatus(asCleanText(entry.status));
  const season = asCleanText(entry.animeSeason?.season);
  const year = Number(entry.animeSeason?.year || 0);
  const episodes = Number(entry.episodes || 0);

  pieces.push(`Tipo: ${normalizedType}`);
  pieces.push(`Status: ${normalizedStatus}`);

  if (year > 0) {
    const seasonal = season && season !== "UNDEFINED" ? `${season.toLowerCase()} ${year}` : String(year);
    pieces.push(`Estreia: ${seasonal}`);
  }

  if (episodes > 0) {
    pieces.push(`Episodios: ${episodes}`);
  }

  const tagsSnippet = categories.slice(0, 8);
  if (tagsSnippet.length) {
    pieces.push(`Tags: ${tagsSnippet.join(", ")}`);
  }

  const synonym = asCleanText(entry.synonyms?.[0]);
  if (synonym) {
    pieces.push(`Sinonimo: ${synonym}`);
  }

  return pieces.join(". ");
}

function computeMatchScore(query: string, option: AdminAnimeMetadataOption) {
  const normalizedQuery = asCleanText(query).toLowerCase();
  const normalizedTitle = asCleanText(option.matchedTitle).toLowerCase();
  let score = 0;

  if (normalizedTitle === normalizedQuery) score += 140;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 90;
  else if (normalizedTitle.includes(normalizedQuery)) score += 60;

  if (option.description) score += 10;
  if (option.categories.length) score += 8;
  if (option.coverImage) score += 10;
  if (option.bannerImage) score += 10;
  if (typeof option.score === "number") score += Math.max(0, Math.min(option.score, 10));
  if (option.source === "mal") score += 4;

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
        matchedTitle: asCleanText(item.title) || "Sem titulo",
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
        matchedTitle: asCleanText(entry.title) || "Sem titulo",
        coverImage: coverImage || undefined,
        bannerImage: bannerImage || coverImage || undefined,
        description: buildFindMyAnimeDescription(entry, categories) || undefined,
        categories,
        score:
          typeof entry.score?.arithmeticMean === "number"
            ? entry.score.arithmeticMean
            : undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function searchAnimeMetadataOptions(query: string, limit = 12) {
  const normalizedQuery = asCleanText(query);
  const safeLimit = Math.max(1, Math.min(30, Number(limit || 12)));
  if (normalizedQuery.length < 2) return [] as AdminAnimeMetadataOption[];

  const [malOptions, findMyAnimeOptions] = await Promise.all([
    mapMalOptions(normalizedQuery, safeLimit),
    mapFindMyAnimeOptions(normalizedQuery, safeLimit),
  ]);

  const merged = [...malOptions, ...findMyAnimeOptions]
    .map((option) => ({
      ...option,
      __matchScore: computeMatchScore(normalizedQuery, option),
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
    if (option.__matchScore > current.__matchScore) {
      deduped.set(key, option);
    }
  }

  return Array.from(deduped.values())
    .slice(0, safeLimit)
    .map(({ __matchScore, ...option }) => option);
}
