import prisma from "@/lib/prisma";
import type {
  CatalogDetail,
  CatalogEpisodeItem,
  CatalogHomePayload,
  CatalogItem,
  CatalogSeasonItem,
} from "@/lib/catalog/types";

function safeSlug(id: string, slug?: string | null) {
  return String(slug || id).trim();
}

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizeKind(value: unknown) {
  const current = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (current === "filme") return "movie";
  if (current === "series") return "serie";
  return current || "anime";
}

function normalizeStatus(value: unknown, fallback = "ongoing") {
  return text(value).toLowerCase() || fallback;
}

function isVisibleCanonicalStatus(value: unknown) {
  const status = normalizeStatus(value, "draft");
  return status === "public" || status === "published";
}

function durationLabelFromSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "";
  const minutes = Math.max(1, Math.round(value / 60));
  return `${minutes} min`;
}

function visibleLegacySeasonNumbers(seasons: Array<{ number: number; status: string }>) {
  return new Set(
    seasons
      .filter((season) => normalizeStatus(season.status, "published") !== "draft")
      .map((season) => Number(season.number || 1)),
  );
}

function visibleCanonicalSeasonIds(seasons: Array<{ id: string; status: string }>) {
  return new Set(
    seasons
      .filter((season) => isVisibleCanonicalStatus(season.status))
      .map((season) => season.id),
  );
}

function mapLegacyItem(item: any): CatalogItem {
  const posterUrl = text(item.coverImage);
  const bannerUrl = text(item.bannerImage) || posterUrl;
  return {
    source: "legacy",
    id: item.id,
    slug: safeSlug(item.id, item.slug),
    title: text(item.title) || "Sem titulo",
    synopsis: text(item.description),
    posterUrl,
    bannerUrl,
    coverImage: posterUrl,
    kind: normalizeKind(item.mediaType),
    status: normalizeStatus(item.status),
    language: text(item.language),
    year: item.year ?? null,
    isFeatured: Boolean(item.isFeatured),
    episodeCount: Number(item._count?.episodes || item.episodes?.length || 0),
    updatedAt: item.updatedAt,
  };
}

function mapCanonicalItem(item: any): CatalogItem {
  const posterUrl = text(item.posterUrl);
  const bannerUrl = text(item.bannerUrl) || posterUrl;
  return {
    source: "canonical",
    id: item.id,
    slug: safeSlug(item.id, item.slug),
    title: text(item.title) || "Sem titulo",
    synopsis: text(item.synopsis),
    posterUrl,
    bannerUrl,
    coverImage: posterUrl,
    kind: normalizeKind(item.kind),
    status: normalizeStatus(item.status, "draft"),
    language: text(item.language),
    year: item.year ?? null,
    isFeatured: Boolean(item.isFeatured),
    episodeCount: Number(item._count?.episodes || item.episodes?.length || 0),
    updatedAt: item.updatedAt,
  };
}

function mapLegacySeason(season: any): CatalogSeasonItem {
  return {
    id: season.id,
    number: Number(season.number || 1),
    title: text(season.name) || `Temporada ${Number(season.number || 1)}`,
    synopsis: text(season.description),
    status: normalizeStatus(season.status, "published"),
  };
}

function mapCanonicalSeason(season: any): CatalogSeasonItem {
  return {
    id: season.id,
    number: Number(season.seasonNumber || 1),
    title: text(season.title) || `Temporada ${Number(season.seasonNumber || 1)}`,
    synopsis: text(season.synopsis),
    status: normalizeStatus(season.status, "draft"),
  };
}

function episodeSlug(id: string, slug: string | null | undefined, number: number, title: string) {
  const value = text(slug);
  if (value) return value;
  const normalized = text(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || `episodio-${number || id}`;
}

function watchHrefFor(contentSlug: string, episodeSlugValue: string, episodeId: string) {
  return `/assistir/${encodeURIComponent(contentSlug)}/${encodeURIComponent(episodeSlugValue || episodeId)}`;
}

function mapLegacyEpisode(episode: any, contentId: string, contentSlug: string): CatalogEpisodeItem {
  const durationLabel = text(episode.duration);
  const hasSource =
    Boolean(text(episode.videoUrl)) ||
    Boolean(text(episode.externalProvider)) ||
    Number(episode._count?.sources || episode.sources?.length || 0) > 0;
  const number = Number(episode.number || 1);
  const title = text(episode.title) || `Episodio ${number}`;
  const slug = episodeSlug(episode.id, null, number, title);

  return {
    source: "legacy",
    id: episode.id,
    slug,
    contentId,
    seasonNumber: Number(episode.season || 1),
    episodeNumber: number,
    title,
    synopsis: text(episode.description),
    thumbnailUrl: text(episode.thumbnailUrl),
    durationLabel,
    durationSeconds: null,
    status: normalizeStatus(episode.status, "published"),
    watchHref: hasSource ? watchHrefFor(contentSlug, slug, episode.id) : null,
    isPlayable: hasSource,
  };
}

function mapCanonicalEpisode(episode: any, contentId: string, contentSlug: string, seasonNumber: number): CatalogEpisodeItem {
  const sourceCount = Number(episode._count?.sources || episode.sources?.length || 0);
  const number = Number(episode.episodeNumber || 1);
  const title = text(episode.title) || `Episodio ${number}`;
  const slug = episodeSlug(episode.id, episode.slug, number, title);
  return {
    source: "canonical",
    id: episode.id,
    slug,
    contentId,
    seasonNumber,
    episodeNumber: number,
    title,
    synopsis: text(episode.synopsis),
    thumbnailUrl: text(episode.thumbnailUrl),
    durationLabel: durationLabelFromSeconds(episode.durationSec),
    durationSeconds: episode.durationSec ?? null,
    status: normalizeStatus(episode.status, "draft"),
    watchHref: sourceCount > 0 ? watchHrefFor(contentSlug, slug, episode.id) : null,
    isPlayable: sourceCount > 0,
  };
}

function dedupeAndSort(items: CatalogItem[], limit: number) {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const titleKey = item.title.toLowerCase();
      const key = item.slug || `${item.source}:${item.id}`;
      const dedupeKey = titleKey ? `${item.kind}:${titleKey}` : key;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function listPublicCatalogItems(limit = 48): Promise<CatalogItem[]> {
  const take = Math.max(1, Math.min(160, limit));
  const [legacy, canonical] = await Promise.all([
    prisma.anime.findMany({
      where: { visibility: "public" },
      include: { _count: { select: { episodes: true } } },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take,
    }),
    prisma.content.findMany({
      where: { status: { in: ["public", "published"] } },
      include: { _count: { select: { episodes: true } } },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take,
    }),
  ]);

  return dedupeAndSort([...legacy.map(mapLegacyItem), ...canonical.map(mapCanonicalItem)], take);
}

export async function searchPublicCatalogItems(query: string, limit = 48): Promise<CatalogItem[]> {
  const q = text(query);
  if (q.length < 2) return listPublicCatalogItems(limit);
  const take = Math.max(1, Math.min(120, limit));
  const [legacy, canonical] = await Promise.all([
    prisma.anime.findMany({
      where: {
        visibility: "public",
        title: { contains: q, mode: "insensitive" },
      },
      include: { _count: { select: { episodes: true } } },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take,
    }),
    prisma.content.findMany({
      where: {
        status: { in: ["public", "published"] },
        title: { contains: q, mode: "insensitive" },
      },
      include: { _count: { select: { episodes: true } } },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take,
    }),
  ]);

  const score = (item: CatalogItem) => {
    const title = item.title.toLowerCase();
    const normalized = q.toLowerCase();
    if (title === normalized) return 100;
    if (title.startsWith(normalized)) return 80;
    if (title.includes(normalized)) return 50;
    return 0;
  };

  return dedupeAndSort([...legacy.map(mapLegacyItem), ...canonical.map(mapCanonicalItem)], take)
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, take);
}

export async function getCatalogDetail(idOrSlug: string): Promise<CatalogDetail | null> {
  const key = text(idOrSlug);
  if (!key) return null;

  const legacy = await prisma.anime.findFirst({
    where: {
      visibility: "public",
      OR: [{ id: key }, { slug: key }],
    },
    include: {
      seasons: { orderBy: { number: "asc" } },
      episodes: {
        where: { status: "published" },
        include: { _count: { select: { sources: true } } },
        orderBy: [{ season: "asc" }, { number: "asc" }],
      },
      _count: { select: { episodes: true } },
    },
  });

  if (legacy) {
    const contentSlug = safeSlug(legacy.id, legacy.slug);
    const seasonNumbers = visibleLegacySeasonNumbers(legacy.seasons);
    const episodes = legacy.episodes
      .filter((episode) => seasonNumbers.size === 0 || seasonNumbers.has(Number(episode.season || 1)))
      .map((episode) => mapLegacyEpisode(episode, legacy.id, contentSlug));
    const viewers = await prisma.watchHistory.count({
      where: {
        episode: { animeId: legacy.id },
        OR: [{ watched: true }, { progressSec: { gte: 30 } }],
      },
    });

    return {
      ...mapLegacyItem(legacy),
      seasons: legacy.seasons
        .map(mapLegacySeason)
        .filter((season) => season.status !== "draft"),
      episodes,
      viewerCount: viewers,
      matchScore: 80 + (legacy.title.length % 20),
    };
  }

  const canonical = await prisma.content.findFirst({
    where: {
      status: { in: ["public", "published"] },
      OR: [{ id: key }, { slug: key }],
    },
    include: {
      seasons: { orderBy: { seasonNumber: "asc" } },
      episodes: {
        where: { status: { in: ["public", "published"] } },
        include: {
          season: true,
          _count: { select: { sources: true } },
        },
        orderBy: [{ seasonId: "asc" }, { episodeNumber: "asc" }],
      },
      _count: { select: { episodes: true } },
    },
  });

  if (!canonical) return null;

  const contentSlug = safeSlug(canonical.id, canonical.slug);
  const visibleSeasonIds = visibleCanonicalSeasonIds(canonical.seasons);
  const seasonNumberById = new Map(
    canonical.seasons.map((season) => [season.id, Number(season.seasonNumber || 1)]),
  );

  return {
    ...mapCanonicalItem(canonical),
    seasons: canonical.seasons
      .map(mapCanonicalSeason)
      .filter((season) => isVisibleCanonicalStatus(season.status)),
    episodes: canonical.episodes
      .filter((episode) => !episode.seasonId || visibleSeasonIds.has(episode.seasonId))
      .map((episode) =>
        mapCanonicalEpisode(
          episode,
          canonical.id,
          contentSlug,
          episode.seasonId ? seasonNumberById.get(episode.seasonId) || 1 : 1,
        ),
      ),
    viewerCount: 0,
    matchScore: 80 + (canonical.title.length % 20),
  };
}

export async function getCatalogHomePayload(): Promise<CatalogHomePayload> {
  const items = await listPublicCatalogItems(96);
  const hero = items.find((item) => item.isFeatured && item.bannerUrl) || items[0] || null;
  const latest = [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const withEpisodes = items.filter((item) => item.episodeCount > 0);
  const movies = items.filter((item) => item.kind === "movie");
  const series = items.filter((item) => item.kind === "serie");
  const featured = items.filter((item) => item.isFeatured);

  const rails = [
    {
      id: "featured",
      title: "Destaques",
      subtitle: "Titulos em evidencia no catalogo",
      items: (featured.length ? featured : items).slice(0, 16),
    },
    {
      id: "latest",
      title: "Atualizados agora",
      subtitle: "Entradas recentes e publicadas",
      items: latest.slice(0, 18),
    },
    {
      id: "episodes",
      title: "Com episodios",
      subtitle: "Prontos para assistir",
      items: (withEpisodes.length ? withEpisodes : items).slice(0, 18),
    },
    {
      id: "movies-series",
      title: "Filmes e series",
      subtitle: "Quando o catalogo tiver formatos diferentes",
      items: [...movies, ...series].slice(0, 18),
    },
  ].filter((rail) => rail.items.length > 0);

  const [legacyEpisodeCount, canonicalEpisodeCount, legacySourceCount, canonicalSourceCount] = await Promise.all([
    prisma.episode.count({ where: { status: "published", anime: { visibility: "public" } } }),
    prisma.catalogEpisode.count({ where: { status: { in: ["public", "published"] }, content: { status: { in: ["public", "published"] } } } }),
    prisma.episodeSource.count({ where: { isActive: true, episode: { status: "published", anime: { visibility: "public" } } } }),
    prisma.source.count({ where: { isActive: true, episode: { status: { in: ["public", "published"] }, content: { status: { in: ["public", "published"] } } } } }),
  ]);

  return {
    hero,
    rails,
    stats: {
      titles: items.length,
      episodes: legacyEpisodeCount + canonicalEpisodeCount,
      sources: legacySourceCount + canonicalSourceCount,
    },
  };
}
