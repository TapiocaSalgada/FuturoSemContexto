import { getServerSession } from "next-auth";
import Link from "next/link";
import Image from "next/image";
import { Clock, Heart, Play, TrendingUp } from "lucide-react";
import { unstable_cache } from "next/cache";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import HomeCTA from "@/components/HomeCTA";
import SuggestionButton from "@/components/SuggestionButton";
import AnimeCard from "@/components/AnimeCard";

export const dynamic = "force-dynamic";

const getCachedRecentAnimes = unstable_cache(
  async () => {
    return prisma.anime.findMany({
      where: { visibility: "public" },
      orderBy: { id: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        description: true,
        coverImage: true,
        bannerImage: true,
        status: true,
        visibility: true,
        episodes: {
          orderBy: [{ season: "asc" }, { number: "asc" }],
          take: 1,
          select: { id: true }
        },
        ratings: {
          select: { rating: true }
        }
      },
    });
  },
  ['recent-animes-home'],
  { revalidate: 60 } // cache 1 minute
);

const getCachedTrending = unstable_cache(
  async () => {
    return prisma.watchHistory.groupBy({
      by: ["episodeId"],
      _count: { episodeId: true },
      orderBy: { _count: { episodeId: "desc" } },
      take: 30,
    });
  },
  ['trending-data-home'],
  { revalidate: 120 } // cache 2 minutes
);

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  let recentHistory: any[] = [];
  
  if (session?.user && (session.user as any).id) {
    const userId = (session.user as any).id;
    recentHistory = await prisma.watchHistory.findMany({
      where: { userId: userId, progressSec: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        progressSec: true,
        updatedAt: true,
        episode: {
          select: { id: true, number: true, season: true, thumbnailUrl: true, anime: { select: { id: true, title: true, coverImage: true } } },
        },
      },
      take: 24,
    });
  }

  const [recentAnimes, trendingData] = await Promise.all([
    getCachedRecentAnimes(),
    getCachedTrending(),
  ]);

  const trendingEpisodeIds = trendingData.map((item) => item.episodeId);
  const trendingEpisodes =
    trendingEpisodeIds.length > 0
      ? await prisma.episode.findMany({
          where: {
            id: { in: trendingEpisodeIds },
            anime: { visibility: "public" },
          },
          select: {
            id: true,
            animeId: true,
            number: true,
            season: true,
            anime: { select: { id: true, title: true, coverImage: true } },
          },
        })
      : [];

  const trendingAnimes = trendingEpisodeIds
    .map((episodeId) =>
      trendingEpisodes.find((episode) => episodeId === episode.id),
    )
    .filter(Boolean)
    .reduce<typeof trendingEpisodes>((items, episode) => {
      if (!episode) return items;
      if (items.some((item) => item.animeId === episode.animeId)) return items;
      items.push(episode);
      return items;
    }, [])
    .slice(0, 8);

  const continueWatching = recentHistory.reduce((items: typeof recentHistory, history) => {
    const animeId = history.episode?.anime?.id;
    if (!animeId) return items;
    if (items.some((item) => item.episode?.anime?.id === animeId)) return items;
    return [...items, history];
  }, [] as typeof recentHistory);

  const featured = recentAnimes[0];
  
  let featuredRelevance = 98;
  if (featured && (featured as any).ratings && (featured as any).ratings.length > 0) {
    const rArray = (featured as any).ratings;
    const avg = rArray.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) / rArray.length;
    featuredRelevance = Math.max(10, Math.round((avg / 5) * 100));
  } else if (featured) {
    featuredRelevance = 80 + (featured.title.length % 20);
  }

  const featuredHref = featured?.episodes?.[0]
    ? `/watch/${featured.episodes[0].id}`
    : featured
      ? `/anime/${featured.id}`
      : "/";

  return (
    <AppLayout>
      <div className="pb-24">
        {featured ? (
          <section className="relative w-full min-h-[75vh] lg:min-h-[85vh] flex flex-col justify-end p-6 lg:p-14 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <Image
                src={featured.bannerImage || featured.coverImage || "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"}
                fill
                priority
                className="hidden md:block object-cover opacity-60 scale-105 transition-transform duration-700"
                alt={featured.title}
              />
              {/* Mobile Cover (Portrait) */}
              <Image
                src={featured.coverImage || featured.bannerImage || "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"}
                fill
                priority
                className="md:hidden object-cover opacity-70 scale-105 transition-transform duration-700"
                alt={featured.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060606] via-[#060606]/40 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,6,6,0.88)_100%)]" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-4 animate-fadeInUp">
              <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                <Image src="/logo.png" alt="Futuro sem Contexto" width={24} height={24} className="rounded-lg object-cover" />
                <span className="text-pink-400 font-black tracking-[0.2em] text-[11px] uppercase">
                  Futuro em destaque
                </span>
              </div>
              <h1 className="text-4xl lg:text-7xl font-black uppercase tracking-tight text-white drop-shadow-md leading-none">
                {featured.title}
              </h1>
              <p className="text-zinc-300 text-sm lg:text-base line-clamp-3 max-w-xl">
                {featured.description || "Seu proximo anime ja esta pronto para entrar em tela cheia."}
              </p>
              <div className="flex items-center gap-4 text-sm font-bold mt-2">
                <span className="text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                  {featuredRelevance}% Relevante
                </span>
                <span className="text-zinc-400">TV</span>
                <span className="text-zinc-400 px-1.5 py-0.5 border border-zinc-600 rounded text-[10px]">HD</span>
              </div>
              <div className="flex items-center gap-3 pt-2 w-full md:w-auto">
                <Link prefetch={true}
                  href={featuredHref}
                  className="flex-1 md:flex-none justify-center bg-white text-black px-7 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-white/90 hover:scale-105 transition-all text-sm"
                >
                  <Play fill="currentColor" size={16} /> Assistir
                </Link>
                <Link prefetch={true}
                  href={`/anime/${featured.id}`}
                  className="flex-1 md:flex-none justify-center bg-zinc-800/80 backdrop-blur-md text-white px-7 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-700 hover:scale-105 transition-all text-sm"
                >
                  Detalhes
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="h-[40vh] flex items-center justify-center text-zinc-500 flex-col gap-3">
            <Image src="/logo.png" alt="Futuro sem Contexto" width={56} height={56} className="rounded-2xl object-cover opacity-70" />
            <p className="text-lg font-bold">Catalogo vazio.</p>
            <HomeCTA />
          </div>
        )}

        <div className="px-6 lg:px-14 mt-[-20px] relative z-20 space-y-12">
          {continueWatching.length > 0 && (
            <section className="animate-fadeInUp">
              <h2 className="text-lg font-black flex items-center gap-2 mb-5 border-l-4 border-pink-500 pl-4">
                <Play size={18} className="text-pink-500" /> Continue Assistindo
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {continueWatching.map((history) => {
                  const anime = history.episode?.anime;
                  if (!anime || !history.episode) return null;
                  return (
                    <Link prefetch={true}
                      key={history.id}
                      href={`/watch/${history.episode.id}`}
                      className="w-[170px] lg:w-[210px] shrink-0 snap-start group"
                    >
                      <div className="aspect-video rounded-2xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition-all duration-300 bg-zinc-900 group-hover:shadow-[0_0_20px_rgba(255,0,127,0.3)]">
                        <Image
                          src={history.episode?.thumbnailUrl || anime.coverImage || "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"}
                          fill
                          sizes="(max-width: 768px) 170px, 210px"
                          className="object-cover opacity-70 group-hover:scale-105 transition duration-500"
                          alt={anime.title}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-pink-600/90 text-white flex items-center justify-center shadow-[0_0_15px_rgba(255,0,127,0.6)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                            <Play size={18} className="ml-1" fill="currentColor" />
                          </div>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                          <div
                            className="h-full bg-pink-500 relative"
                            style={{
                              width: `${Math.max(
                                12,
                                Math.min(
                                  98,
                                  Math.round(
                                    (history.progressSec /
                                      Math.max(history.progressSec + 300, 900)) *
                                      100,
                                  ),
                                ),
                              )}%`,
                            }}
                          >
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:block w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-white font-bold mt-2 truncate">
                        {anime.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        T{history.episode.season} Ep {history.episode.number}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {trendingAnimes.length > 0 && (
            <section className="animate-fadeInUp">
              <h2 className="text-lg font-black flex items-center gap-2 mb-5 border-l-4 border-pink-500 pl-4">
                <TrendingUp size={18} className="text-pink-500" /> Em Alta
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {trendingAnimes.map((episode, index) => (
                  <AnimeCard
                    key={episode.animeId}
                    href={`/anime/${episode.animeId}`}
                    title={episode.anime?.title || ""}
                    image={episode.anime?.coverImage}
                    className="w-[130px] lg:w-[160px]"
                    badgeTopLeft={
                      <div className="w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(255,0,127,0.5)]">
                        {index + 1}
                      </div>
                    }
                    overlayText={
                      <p className="text-[11px] text-zinc-300">
                        T{episode.season} Ep {episode.number}
                      </p>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {recentAnimes.length > 0 && (
            <section className="animate-fadeInUp delay-200">
              <h2 className="text-lg font-black flex items-center gap-2 mb-5 border-l-4 border-pink-500 pl-4">
                <Clock size={18} className="text-pink-500" /> Adicionados Recentemente
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {recentAnimes.map((anime) => (
                  <AnimeCard
                    key={anime.id}
                    href={`/anime/${anime.id}`}
                    title={anime.title}
                    image={anime.coverImage}
                    className="w-[130px] lg:w-[160px]"
                    overlayText={
                      <div className="flex items-center gap-1">
                        <Heart size={10} className="text-pink-400 fill-pink-400" />
                        <span className="text-xs text-zinc-400">Novo Episódio</span>
                      </div>
                    }
                    subTitle={anime.title}
                  />
                ))}
              </div>
            </section>
          )}

          <HomeCTA />
        </div>

        <SuggestionButton />
      </div>
    </AppLayout>
  );
}
