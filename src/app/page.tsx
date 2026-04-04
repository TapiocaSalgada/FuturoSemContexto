import { getServerSession } from "next-auth";
import { Heart, Layers, Sparkles, TrendingUp } from "lucide-react";
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

const ROW_SIZE = 20;

const CATALOG_BLOCK_PRESETS = [
  {
    title: "Faixa Abertura",
    hint: "Abertura do catálogo com escolhas variadas.",
    borderClass: "border-l-4 border-red-600",
    iconClass: "text-red-300",
    chipClass: "bg-red-500/18 text-red-100 border border-red-400/25",
  },
  {
    title: "Faixa Sessão",
    hint: "Mais 20 para continuar sem repetição chata.",
    borderClass: "border-l-4 border-orange-500",
    iconClass: "text-orange-300",
    chipClass: "bg-orange-500/18 text-orange-100 border border-orange-400/25",
  },
  {
    title: "Faixa Intermissão",
    hint: "Mix de títulos para maratona rápida.",
    borderClass: "border-l-4 border-amber-500",
    iconClass: "text-amber-300",
    chipClass: "bg-amber-500/18 text-amber-100 border border-amber-400/25",
  },
  {
    title: "Faixa Madrugada",
    hint: "Pacote extra com corte fresco do catálogo.",
    borderClass: "border-l-4 border-rose-600",
    iconClass: "text-rose-300",
    chipClass: "bg-rose-500/18 text-rose-100 border border-rose-400/25",
  },
  {
    title: "Faixa Arquivo",
    hint: "Continuação aleatória para achar anime escondido.",
    borderClass: "border-l-4 border-zinc-500",
    iconClass: "text-zinc-300",
    chipClass: "bg-zinc-700/60 text-zinc-100 border border-zinc-500/40",
  },
];

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

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

function CardRow({
  items,
  subtitle,
}: {
  items: Pick<HomeAnime, "id" | "title" | "coverImage">[];
  subtitle?: (item: Pick<HomeAnime, "id" | "title" | "coverImage">) => ReactNode;
}) {
  return (
    <HorizontalCarousel>
      {items.map((anime) => (
        <div key={anime.id} className="snap-start shrink-0">
          <AnimeCard
            href={`/anime/${anime.id}`}
            title={anime.title || "Sem titulo"}
            image={anime.coverImage}
            className="w-[140px] sm:w-[150px] md:w-[165px]"
            subTitle={subtitle ? subtitle(anime) : undefined}
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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="kdr-section-title">
          {icon}
          <span className="truncate">{title}</span>
          {highlight ? <span className="kdr-section-title-accent">{highlight}</span> : null}
        </h2>
        {subtitle ? <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";
  const userId = (session?.user as any)?.id as string | undefined;

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  let allAnimes: HomeAnime[] = [];
  let trendingData: any[] = [];
  let recentHistory: any[] = [];
  let watchedForRec: any[] = [];

  try {
    [allAnimes, trendingData, recentHistory, watchedForRec] = await Promise.all([
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
        take: 40,
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
            where: {
              userId,
              watched: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 140,
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
    ]);
  } catch (error) {
    console.error("home-data-load-error", error);
  }

  const visibleAnimes = isAdmin
    ? (allAnimes as HomeAnime[])
    : (allAnimes as HomeAnime[]).filter((anime) => isPublicVisibility(anime.visibility));

  const validAnimes = dedupeById(visibleAnimes.filter((a) => a?.id && a?.title));

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

  const trendingEpisodeIds = trendingData.map((item) => item.episodeId);
  let trendingEpisodes: any[] = [];
  if (trendingEpisodeIds.length > 0) {
    try {
      trendingEpisodes = await prisma.episode.findMany({
        where: { id: { in: trendingEpisodeIds } },
        select: {
          id: true,
          animeId: true,
          number: true,
          season: true,
          anime: { select: { id: true, title: true, coverImage: true, visibility: true } },
        },
      });
    } catch (error) {
      console.error("home-trending-load-error", error);
      trendingEpisodes = [];
    }
  }

  const trendingVisibleEpisodes = isAdmin
    ? trendingEpisodes
    : trendingEpisodes.filter((episode) => isPublicVisibility(episode?.anime?.visibility));

  const trendingAnimes = trendingEpisodeIds
    .map((episodeId) => trendingVisibleEpisodes.find((episode) => episodeId === episode.id))
    .filter(Boolean)
    .reduce<typeof trendingEpisodes>((items, episode) => {
      if (!episode) return items;
      if (items.some((item) => item.animeId === episode.animeId)) return items;
      items.push(episode);
      return items;
    }, [])
    .slice(0, ROW_SIZE);

  const mostLiked = [...validAnimes]
    .map((anime) => ({
      ...anime,
      avg: anime.ratings.length
        ? anime.ratings.reduce((acc, item) => acc + item.rating, 0) / anime.ratings.length
        : 0,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, ROW_SIZE);

  const ongoing = validAnimes.filter((anime) => anime.status === "ongoing");
  const completed = validAnimes.filter((anime) => anime.status === "completed");

  const watchedAnime = watchedForRec
    .map((item) => item.episode?.anime)
    .filter((anime) => Boolean(anime) && (isAdmin || isPublicVisibility((anime as any)?.visibility))) as {
      id: string;
      title: string;
      visibility?: string | null;
      categories: { id: string; name: string }[];
    }[];
  const watchedAnimeIds = new Set(watchedAnime.map((item) => item.id));

  const categoryCounter = new Map<string, { id: string; name: string; count: number }>();
  for (const anime of watchedAnime) {
    for (const category of anime.categories) {
      const prev = categoryCounter.get(category.id);
      categoryCounter.set(category.id, {
        id: category.id,
        name: category.name,
        count: (prev?.count || 0) + 1,
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
  const fallbackRecommended = dedupeById(
    shuffle(validAnimes).filter((anime) => !watchedAnimeIds.has(anime.id)),
  );
  const recommended = dedupeById([...genreRecommended, ...fallbackRecommended]).slice(0, 16);
  const recommendedTop = recommended.slice(0, ROW_SIZE);

  const categorySections = (() => {
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
      .map((section) => ({
        ...section,
        items: dedupeById(shuffle(section.items)),
      }))
      .filter((section) => section.items.length >= 6)
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 10);
  })();

  const catalogGroups = chunkItems(shuffle(validAnimes), ROW_SIZE);

  return (
    <AppLayout>
      <div className="pb-28 md:pb-24">
        {heroItems.length > 0 ? (
          <HomeHeroRotator items={heroItems} />
        ) : (
          <div className="h-[40vh] flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center space-y-2">
              <Sparkles size={32} className="mx-auto text-[var(--text-accent)] opacity-50" />
              <p className="text-sm font-bold">Catálogo vazio</p>
            </div>
          </div>
        )}

        <div className="px-4 sm:px-6 lg:px-10 mt-8 relative z-20 space-y-10 lg:space-y-12">
          <section className="rounded-3xl border border-white/12 bg-black/35 backdrop-blur-md p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-black">Catálogo total</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1">{validAnimes.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-black">Continue vendo</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1">{continueWatching.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-black">Faixas por gênero</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1">{categorySections.length}</p>
            </div>
          </section>

          <ContinueWatchingRail items={continueWatching as any} />

          {trendingAnimes.length > 0 && (
            <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<TrendingUp size={16} className="kdr-section-title-accent" />}
                title="Em alta"
                highlight="Agora"
                subtitle="Episódios com maior giro recente na plataforma."
              />
              <HorizontalCarousel>
                {trendingAnimes.map((episode, index) => (
                  <div key={episode.animeId} className="snap-start shrink-0">
                    <AnimeCard
                      href={`/anime/${episode.animeId}`}
                      title={episode.anime?.title || ""}
                      image={episode.anime?.coverImage}
                      className="w-[140px] sm:w-[155px] md:w-[170px]"
                      badgeTopLeft={
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white border border-white/15"
                          style={{ background: "linear-gradient(135deg, var(--accent), #7f1d1d)", boxShadow: `0 4px 12px var(--accent-glow)` }}
                        >
                          {index + 1}
                        </div>
                      }
                      overlayText={<p className="text-[10px] text-[var(--text-secondary)]">T{episode.season} Ep {episode.number}</p>}
                    />
                  </div>
                ))}
              </HorizontalCarousel>
            </section>
          )}

          {recommendedTop.length > 0 && (
            <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<Sparkles size={16} className="kdr-section-title-accent" />}
                title={becauseWatchedAnime?.title
                  ? `Porque você assistiu ${becauseWatchedAnime.title}`
                  : "Recomendados para você"}
                subtitle="Curadoria automática baseada no que você já terminou."
              />
              <CardRow
                items={recommendedTop}
                subtitle={() => (
                  <span className="text-[11px] text-[var(--text-accent)]">
                    {topCategory ? `Baseado em ${topCategory.name}` : "Sugestão personalizada"}
                  </span>
                )}
              />
            </section>
          )}

          {mostLiked.length > 0 && (
            <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<Heart size={16} className="kdr-section-title-accent" />}
                title="Mais curtidos"
                subtitle="Notas mais altas da comunidade, em ordem de impacto."
              />
              <CardRow
                items={mostLiked}
                subtitle={(anime) => {
                  const found = mostLiked.find((item) => item.id === anime.id);
                  return (
                    <span className="flex items-center gap-1 text-[11px] text-yellow-400">
                      ★ {found?.avg?.toFixed(1) || "0.0"}
                    </span>
                  );
                }}
              />
            </section>
          )}

          {ongoing.length > 0 && (
            <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<Layers size={16} className="kdr-section-title-accent" />}
                title="Em lançamento"
                subtitle="Séries quentes que ainda estão ganhando episódio."
              />
              <CardRow items={ongoing.slice(0, ROW_SIZE)} subtitle={() => <span className="text-[11px] kdr-badge kdr-badge-accent">Novos episódios</span>} />
            </section>
          )}

          {completed.length > 0 && (
            <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<Layers size={16} className="kdr-section-title-accent" />}
                title="Finalizados"
                subtitle="Perfeitos para maratonar do começo ao fim."
              />
              <CardRow items={completed.slice(0, ROW_SIZE)} subtitle={() => <span className="text-[11px] kdr-badge kdr-badge-info">Pronto para maratona</span>} />
            </section>
          )}

          {categorySections.map((section) => (
            <section key={section.name} className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              <SectionHeader
                icon={<Sparkles size={16} className="kdr-section-title-accent" />}
                title={section.name}
                subtitle="Recorte por categoria com rotações frequentes."
              />
              <CardRow items={section.items.slice(0, ROW_SIZE)} />
            </section>
          ))}

          {catalogGroups.map((group, groupIndex) => (
            <section key={`catalog-group-${groupIndex}`} className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
              {(() => {
                const preset = CATALOG_BLOCK_PRESETS[groupIndex % CATALOG_BLOCK_PRESETS.length];
                return (
                  <div className={`mb-4 pl-4 ${preset.borderClass} rounded-r-lg`}>
                    <h2 className="text-lg font-black flex items-center gap-2">
                      <Layers size={18} className={preset.iconClass} />
                      {preset.title}
                      <span className={`ml-1 text-[10px] font-black px-2 py-0.5 rounded-full ${preset.chipClass}`}>
                        {groupIndex + 1}/{catalogGroups.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {preset.hint} • {ROW_SIZE} por faixa • total {validAnimes.length}
                    </p>
                  </div>
                );
              })()}
              <CardRow items={group} />
            </section>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}
