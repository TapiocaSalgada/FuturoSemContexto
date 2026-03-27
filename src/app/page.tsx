import { getServerSession } from "next-auth";
import Link from "next/link";
import { Clock, Heart, Play, TrendingUp } from "lucide-react";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import HomeCTA from "@/components/HomeCTA";
import SuggestionButton from "@/components/SuggestionButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;

  const [recentAnimes, trendingData, recentHistory] = await Promise.all([
    prisma.anime.findMany({
      where: { visibility: "public" },
      orderBy: { id: "desc" },
      take: 12,
      include: {
        categories: true,
        episodes: {
          orderBy: [{ season: "asc" }, { number: "asc" }],
          take: 1,
        },
      },
    }),
    prisma.watchHistory.groupBy({
      by: ["episodeId"],
      _count: { episodeId: true },
      orderBy: { _count: { episodeId: "desc" } },
      take: 30,
    }),
    currentUser
      ? prisma.watchHistory.findMany({
          where: { userId: currentUser.id, progressSec: { gt: 0 } },
          orderBy: { updatedAt: "desc" },
          include: {
            episode: {
              include: {
                anime: {
                  select: { id: true, title: true, coverImage: true },
                },
              },
            },
          },
          take: 24,
        })
      : Promise.resolve([]),
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
  const featuredHref = featured?.episodes?.[0]
    ? `/watch/${featured.episodes[0].id}`
    : featured
      ? `/anime/${featured.id}`
      : "/";

  return (
    <AppLayout>
      <div className="pb-24">
        {featured ? (
          <section className="relative w-full min-h-[56vh] lg:min-h-[66vh] flex flex-col justify-end p-8 lg:p-14 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img
                src={
                  featured.bannerImage ||
                  featured.coverImage ||
                  "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"
                }
                className="w-full h-full object-cover opacity-60 scale-105 transition-transform duration-700"
                alt={featured.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060606] via-[#060606]/40 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,6,6,0.88)_100%)]" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-4 animate-fadeInUp">
              <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                <img src="/logo.png" alt="Futuro sem Contexto" className="w-6 h-6 rounded-lg object-cover" />
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
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <Link
                  href={featuredHref}
                  className="bg-white text-black px-7 py-3 rounded-full font-black flex items-center gap-2 hover:bg-pink-500 hover:text-white transition-all shadow-lg hover:shadow-[0_0_25px_rgba(255,0,127,0.5)] text-sm"
                >
                  <Play fill="currentColor" size={16} /> Assistir Agora
                </Link>
                <Link
                  href={`/anime/${featured.id}`}
                  className="bg-zinc-800/80 backdrop-blur-md text-white px-7 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-700 transition text-sm"
                >
                  Ver pagina do anime
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="h-[40vh] flex items-center justify-center text-zinc-500 flex-col gap-3">
            <img src="/logo.png" alt="Futuro sem Contexto" className="w-14 h-14 rounded-2xl object-cover opacity-70" />
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
                    <Link
                      key={history.id}
                      href={`/watch/${history.episode.id}`}
                      className="w-[170px] lg:w-[210px] shrink-0 snap-start group"
                    >
                      <div className="aspect-video rounded-2xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition-all duration-300 bg-zinc-900">
                        <img
                          src={anime.coverImage || ""}
                          className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition duration-500"
                          alt={anime.title}
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                          <div
                            className="h-full bg-pink-500"
                            style={{
                              width: `${Math.max(
                                12,
                                Math.min(
                                  92,
                                  Math.round(
                                    (history.progressSec /
                                      Math.max(history.progressSec + 300, 900)) *
                                      100,
                                  ),
                                ),
                              )}%`,
                            }}
                          />
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
                  <Link
                    key={episode.animeId}
                    href={`/anime/${episode.animeId}`}
                    className="w-[130px] lg:w-[160px] shrink-0 snap-start group"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,0,127,0.2)]">
                      <img
                        src={episode.anime?.coverImage || ""}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                        alt={episode.anime?.title || ""}
                      />
                      <div className="absolute top-2 left-2 w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(255,0,127,0.5)]">
                        {index + 1}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                        <div>
                          <p className="text-white font-bold text-xs truncate w-full">
                            {episode.anime?.title}
                          </p>
                          <p className="text-[11px] text-zinc-300 mt-1">
                            T{episode.season} Ep {episode.number}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
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
                  <Link
                    key={anime.id}
                    href={`/anime/${anime.id}`}
                    className="w-[130px] lg:w-[160px] shrink-0 snap-start group"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,0,127,0.2)]">
                      <img
                        src={anime.coverImage || ""}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                        alt={anime.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                        <div>
                          <p className="text-white font-bold text-xs truncate">
                            {anime.title}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Heart size={10} className="text-pink-400 fill-pink-400" />
                            <span className="text-xs text-zinc-400">Futuro sem Contexto</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 group-hover:text-white transition mt-2 truncate">
                      {anime.title}
                    </p>
                  </Link>
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
