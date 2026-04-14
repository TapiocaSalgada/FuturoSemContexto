import { getServerSession } from "next-auth";
import { Clock3, Heart, Play, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import AnimeCard from "@/components/AnimeCard";
import HorizontalCarousel from "@/components/HorizontalCarousel";
import ContinueWatchingRail from "@/components/ContinueWatchingRail";
import HomeHeroRotator from "@/components/HomeHeroRotator";
import { isPublicVisibility } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeAnime = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  status: string;
  visibility?: string | null;
  episodes: { id: string }[];
  ratings: { rating: number }[];
  categories: { id: string; name: string; slug: string }[];
};

type HomeRecentEpisode = {
  id: string;
  number: number;
  season: number;
  anime: {
    id: string;
    title: string;
    coverImage?: string | null;
    visibility?: string | null;
  };
};

type HomeTrendEpisode = {
  id: string;
  animeId: string;
  anime: {
    id: string;
    title: string;
    coverImage?: string | null;
    visibility?: string | null;
  };
};

type HomeAnimeCard = Pick<HomeAnime, "id" | "title" | "coverImage">;

type SectionItem = {
  episodeId: string;
  views: number;
};

const ROW_SIZE = 20;

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
  }
  return output;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function randomRow<T>(items: T[], size = ROW_SIZE) {
  return shuffle(items).slice(0, size);
}

function franchiseKey(title: string) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(season|temporada|part|parte|ova|movie|filme)\b/g, "")
    .replace(/\b\d+\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickDiverseHeroes(pool: HomeAnime[], count = 4) {
  const picked: HomeAnime[] = [];
  const usedFranchises = new Set<string>();

  for (const anime of shuffle(pool)) {
    const key = franchiseKey(anime.title) || anime.id;
    if (usedFranchises.has(key)) continue;
    usedFranchises.add(key);
    picked.push(anime);
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    for (const anime of shuffle(pool)) {
      if (picked.some((item) => item.id === anime.id)) continue;
      picked.push(anime);
      if (picked.length >= count) break;
    }
  }

  return picked;
}

function CardRow({ items }: { items: HomeAnimeCard[] }) {
  return (
    <HorizontalCarousel className="pb-1">
      {items.map((anime) => (
        <div key={anime.id} className="snap-start shrink-0">
          <AnimeCard
            href={`/anime/${anime.id}`}
            title={anime.title || "Sem título"}
            image={anime.coverImage}
            className="w-[144px] sm:w-[162px] md:w-[174px]"
          />
        </div>
      ))}
    </HorizontalCarousel>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  highlight,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  highlight?: string;
}) {
  return (
    <div className="mb-4 sm:mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="kdr-section-title">
          {icon}
          <span className="truncate">{title}</span>
          {highlight ? <span className="kdr-section-title-accent">{highlight}</span> : null}
        </h2>
        {subtitle ? <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function HomeRail({
  title,
  subtitle,
  icon,
  highlight,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  highlight?: string;
  items: HomeAnimeCard[];
  emptyMessage?: string;
}) {
  if (!items.length && !emptyMessage) return null;

  return (
    <section className="animate-fadeInUp">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} highlight={highlight} />

      {items.length ? (
        <CardRow items={items} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 sm:px-5 sm:py-7">
          <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

function toSectionItems(
  rows: { episodeId: string; _count: { episodeId: number } }[],
): SectionItem[] {
  return rows.map((row) => ({ episodeId: row.episodeId, views: row._count.episodeId }));
}

function buildTrendAnimeRow(items: SectionItem[], episodesById: Map<string, HomeTrendEpisode>) {
  const animeRows: HomeAnimeCard[] = [];
  const seenAnime = new Set<string>();

  for (const item of items) {
    const episode = episodesById.get(item.episodeId);
    if (!episode?.anime?.id || !episode.anime.title || seenAnime.has(episode.anime.id)) continue;
    seenAnime.add(episode.anime.id);
    animeRows.push({
      id: episode.anime.id,
      title: episode.anime.title,
      coverImage: episode.anime.coverImage,
    });
    if (animeRows.length >= ROW_SIZE) break;
  }

  return animeRows;
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";
  const userId = (session?.user as any)?.id as string | undefined;

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let allAnimes: HomeAnime[] = [];
  let trendingData: SectionItem[] = [];
  let weeklyTrendingData: SectionItem[] = [];
  let recentHistory: any[] = [];
  let watchedForRec: any[] = [];
  let recentEpisodesData: HomeRecentEpisode[] = [];

  try {
    const [
      allAnimesData,
      trendingRaw,
      weeklyTrendingRaw,
      recentHistoryData,
      watchedForRecData,
      recentEpisodesRaw,
    ] = await Promise.all([
      prisma.anime.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          coverImage: true,
          bannerImage: true,
          status: true,
          visibility: true,
          categories: { select: { id: true, name: true, slug: true } },
          episodes: {
            orderBy: [{ season: "asc" }, { number: "asc" }],
            take: 1,
            select: { id: true },
          },
          ratings: { select: { rating: true } },
        },
      }),
      prisma.watchHistory.groupBy({
        by: ["episodeId"],
        _count: { episodeId: true },
        orderBy: { _count: { episodeId: "desc" } },
        take: 70,
      }),
      prisma.watchHistory.groupBy({
        by: ["episodeId"],
        where: { updatedAt: { gte: sevenDaysAgo } },
        _count: { episodeId: true },
        orderBy: { _count: { episodeId: "desc" } },
        take: 70,
      }),
      userId
        ? prisma.watchHistory.findMany({
            where: {
              userId,
              progressSec: { gt: 0 },
              updatedAt: { gte: sixtyDaysAgo },
            },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              progressSec: true,
              updatedAt: true,
              episode: {
                select: {
                  id: true,
                  number: true,
                  season: true,
                  thumbnailUrl: true,
                  anime: {
                    select: {
                      id: true,
                      title: true,
                      coverImage: true,
                      bannerImage: true,
                      visibility: true,
                    },
                  },
                },
              },
            },
            take: 30,
          })
        : Promise.resolve([]),
      userId
        ? prisma.watchHistory.findMany({
            where: { userId, watched: true },
            orderBy: { updatedAt: "desc" },
            take: 150,
            select: {
              episode: {
                select: {
                  anime: {
                    select: {
                      id: true,
                      title: true,
                      visibility: true,
                      categories: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      prisma.episode.findMany({
        orderBy: [{ season: "desc" }, { number: "desc" }],
        take: 140,
        select: {
          id: true,
          number: true,
          season: true,
          anime: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              visibility: true,
            },
          },
        },
      }),
    ]);

    allAnimes = allAnimesData;
    trendingData = toSectionItems(trendingRaw);
    weeklyTrendingData = toSectionItems(weeklyTrendingRaw);
    recentHistory = recentHistoryData;
    watchedForRec = watchedForRecData;
    recentEpisodesData = recentEpisodesRaw;
  } catch (error) {
    console.error("home-data-load-error", error);
  }

  const visibleAnimes = isAdmin
    ? allAnimes
    : allAnimes.filter((anime) => isPublicVisibility(anime.visibility));
  const validAnimes = dedupeById(visibleAnimes.filter((anime) => anime?.id && anime?.title));

  const heroItems = pickDiverseHeroes(validAnimes, 8).map((anime) => ({
    ...anime,
    watchHref: anime.episodes[0]?.id ? `/watch/${anime.episodes[0].id}` : `/anime/${anime.id}`,
  }));

  const continueWatching = recentHistory
    .reduce((items: typeof recentHistory, history) => {
      const animeId = history.episode?.anime?.id;
      if (!animeId) return items;
      if (items.some((item) => item.episode?.anime?.id === animeId)) return items;
      return [...items, history];
    }, [] as typeof recentHistory)
    .filter((item) => isAdmin || isPublicVisibility(item.episode?.anime?.visibility))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      episode: {
        ...(item.episode || {}),
        thumbnailUrl:
          item.episode?.thumbnailUrl ||
          item.episode?.anime?.bannerImage ||
          item.episode?.anime?.coverImage ||
          "/logo.png",
      },
    }));

  const trendingEpisodeIds = [
    ...new Set([
      ...trendingData.map((item) => item.episodeId),
      ...weeklyTrendingData.map((item) => item.episodeId),
    ]),
  ];

  let trendEpisodes: HomeTrendEpisode[] = [];
  if (trendingEpisodeIds.length > 0) {
    try {
      trendEpisodes = await prisma.episode.findMany({
        where: { id: { in: trendingEpisodeIds } },
        select: {
          id: true,
          animeId: true,
          anime: { select: { id: true, title: true, coverImage: true, visibility: true } },
        },
      });
    } catch (error) {
      console.error("home-trending-load-error", error);
      trendEpisodes = [];
    }
  }

  const trendEpisodesVisible = isAdmin
    ? trendEpisodes
    : trendEpisodes.filter((episode) => isPublicVisibility(episode?.anime?.visibility));
  const trendEpisodesById = new Map(trendEpisodesVisible.map((episode) => [episode.id, episode]));

  const trendingTop = buildTrendAnimeRow(trendingData, trendEpisodesById);
  const weeklyTrending = buildTrendAnimeRow(weeklyTrendingData, trendEpisodesById);

  const recentlyAdded = dedupeById(
    (isAdmin
      ? recentEpisodesData
      : recentEpisodesData.filter((episode) => isPublicVisibility(episode?.anime?.visibility))
    )
      .filter((episode) => episode?.anime?.id && episode.anime.title)
      .map((episode) => ({
        id: episode.anime.id,
        title: episode.anime.title,
        coverImage: episode.anime.coverImage,
      })),
  ).slice(0, ROW_SIZE);

  const watchedAnime = watchedForRec
    .map((item) => item.episode?.anime)
    .filter((anime) => Boolean(anime) && (isAdmin || isPublicVisibility((anime as any)?.visibility))) as {
    id: string;
    title: string;
    categories: { id: string; name: string }[];
  }[];
  const watchedAnimeIds = new Set(watchedAnime.map((item) => item.id));

  const categoryCounter = new Map<string, { id: string; name: string; count: number }>();
  for (const anime of watchedAnime) {
    for (const category of anime.categories) {
      const previous = categoryCounter.get(category.id);
      categoryCounter.set(category.id, {
        id: category.id,
        name: category.name,
        count: (previous?.count || 0) + 1,
      });
    }
  }

  const topCategory = Array.from(categoryCounter.values()).sort((a, b) => b.count - a.count)[0];
  const becauseWatchedAnime = topCategory
    ? watchedAnime.find((anime) => anime.categories.some((category) => category.id === topCategory.id))
    : null;

  const genreRecommended = dedupeById(
    validAnimes.filter((anime) => {
      if (!topCategory) return false;
      return anime.categories.some((category) => category.id === topCategory.id) && !watchedAnimeIds.has(anime.id);
    }),
  );
  const fallbackRecommended = dedupeById(shuffle(validAnimes).filter((anime) => !watchedAnimeIds.has(anime.id)));
  const recommendedTop = randomRow(dedupeById([...genreRecommended, ...fallbackRecommended]));

  const mostLikedPool = [...validAnimes]
    .map((anime) => ({
      ...anime,
      avg: anime.ratings.length
        ? anime.ratings.reduce((acc, rating) => acc + rating.rating, 0) / anime.ratings.length
        : 0,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, ROW_SIZE * 3);
  const mostLiked = randomRow(mostLikedPool);

  const dubbedPattern = /\bdub(lado|bed)?\b|dublado/i;
  const dubbed = randomRow(
    validAnimes.filter((anime) => {
      if (dubbedPattern.test(anime.title || "")) return true;
      if (dubbedPattern.test(anime.description || "")) return true;
      return anime.categories.some((category) => dubbedPattern.test(category.name || ""));
    }),
  );

  const curatedCategorySections = (() => {
    const buckets = new Map<string, { name: string; items: HomeAnime[] }>();
    for (const anime of validAnimes) {
      for (const category of anime.categories) {
        if (!buckets.has(category.id)) {
          buckets.set(category.id, { name: category.name, items: [] });
        }
        buckets.get(category.id)!.items.push(anime);
      }
    }

    return Array.from(buckets.values())
      .map((section) => ({ ...section, items: dedupeById(section.items) }))
      .filter((section) => section.items.length >= 9)
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 2)
      .map((section) => ({
        name: section.name,
        items: randomRow(section.items),
      }));
  })();

  return (
    <AppLayout>
      <div className="pb-2 md:pb-4">
        {heroItems.length > 0 ? (
          <HomeHeroRotator items={heroItems} />
        ) : (
          <div className="h-[40vh] flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center space-y-2">
              <Sparkles size={32} className="mx-auto text-[var(--text-accent)] opacity-50" />
              <p className="text-sm font-bold">Catálogo indisponível no momento</p>
            </div>
          </div>
        )}

        <div className="relative z-20 mx-auto mt-8 w-full max-w-[1600px] space-y-10 px-4 sm:px-6 lg:space-y-12 lg:px-10">
          <ContinueWatchingRail items={continueWatching as any} />

          <HomeRail
            title="Recomendados para você"
            subtitle={
              becauseWatchedAnime?.title
                ? `Com base em ${becauseWatchedAnime.title}`
                : "Seleção personalizada para sua próxima maratona"
            }
            icon={<Sparkles size={16} className="kdr-section-title-accent" />}
            highlight="Para você"
            items={recommendedTop}
          />

          <HomeRail
            title="Em alta"
            subtitle="Os títulos com mais visualizações na plataforma"
            icon={<TrendingUp size={16} className="kdr-section-title-accent" />}
            highlight="Agora"
            items={trendingTop}
          />

          <HomeRail
            title="Tendências da semana"
            subtitle="O que mais cresceu nos últimos dias"
            icon={<Clock3 size={16} className="kdr-section-title-accent" />}
            items={weeklyTrending}
            emptyMessage="Ainda não há dados suficientes de tendência semanal."
          />

          <HomeRail
            title="Mais curtidos"
            subtitle="Ranking por avaliação média da comunidade"
            icon={<Heart size={16} className="kdr-section-title-accent" />}
            items={mostLiked}
          />

          <HomeRail
            title="Adicionados recentemente"
            subtitle="Novidades alimentadas pelo catálogo de episódios"
            icon={<Play size={16} className="kdr-section-title-accent" />}
            items={recentlyAdded}
          />

          <HomeRail
            title="Dublados"
            subtitle="Seleção rápida para assistir sem legendas"
            icon={<Play size={16} className="kdr-section-title-accent" />}
            items={dubbed}
            emptyMessage="Esta trilha já está pronta e será preenchida conforme novos títulos dublados forem cadastrados."
          />

          {curatedCategorySections.map((section) => (
            <HomeRail
              key={section.name}
              title={section.name}
              subtitle="Curadoria por gênero"
              icon={<Sparkles size={16} className="kdr-section-title-accent" />}
              items={section.items.slice(0, ROW_SIZE)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}


