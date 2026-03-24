import AppLayout from "@/components/AppLayout";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Play, TrendingUp, Clock, Heart } from "lucide-react";
import SuggestionButton from "@/components/SuggestionButton";

export default async function HomePage() {
  // Recently added (all public — visibility filter works at runtime)
  const recentAnimes = await prisma.anime.findMany({
    orderBy: { id: "desc" },
    take: 12,
    include: { categories: true },
  });

  // Trending: group by animeId from watch histories
  const trendingData = await prisma.watchHistory.groupBy({
    by: ["episodeId"],
    _count: { episodeId: true },
    orderBy: { _count: { episodeId: "desc" } },
    take: 30,
  });

  const trendingEpisodeIds = trendingData.map((t) => t.episodeId);
  
  const trendingEpisodes = trendingEpisodeIds.length > 0
    ? await prisma.episode.findMany({
        where: { id: { in: trendingEpisodeIds } },
        select: { animeId: true, anime: { select: { id: true, title: true, coverImage: true } } },
      })
    : [];

  // Deduplicate by anime
  const seenAnimeIds = new Set<string>();
  const trendingAnimes = trendingEpisodes
    .filter((ep) => !seenAnimeIds.has(ep.animeId) && seenAnimeIds.add(ep.animeId))
    .slice(0, 8);

  const featured = recentAnimes[0];

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Hero Banner */}
        {featured ? (
          <section className="relative w-full h-[48vh] lg:h-[58vh] flex flex-col justify-end p-8 lg:p-14">
            <div className="absolute inset-0 z-0">
              <img
                src={featured.bannerImage || featured.coverImage || "https://images.unsplash.com/photo-1618773928120-192518e95085?auto=format&fit=crop&q=80"}
                className="w-full h-full object-cover opacity-60"
                alt={featured.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060606] via-transparent to-transparent" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Heart size={12} className="text-pink-500 fill-pink-500" />
                <span className="text-pink-500 font-bold tracking-widest text-xs uppercase">Futuro sem Contexto</span>
              </div>
              <h1 className="text-3xl lg:text-6xl font-black uppercase tracking-tight text-white drop-shadow-md leading-none">
                {featured.title}
              </h1>
              <p className="text-zinc-300 text-sm lg:text-base line-clamp-2 max-w-xl">
                {featured.description || "Uma obra incrível esperando por você."}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Link href={`/watch/${featured.id}`}
                  className="bg-white text-black px-6 py-2.5 rounded-full font-black flex items-center gap-2 hover:bg-pink-500 hover:text-white transition shadow-lg hover:shadow-[0_0_20px_rgba(255,0,127,0.4)] text-sm">
                  <Play fill="currentColor" size={16} /> ASSISTIR
                </Link>
                <Link href={`/anime/${featured.id}`}
                  className="bg-zinc-800/80 backdrop-blur-md text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-700 transition text-sm">
                  Mais Infos
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="h-[40vh] flex items-center justify-center text-zinc-500 flex-col gap-3">
            <Heart size={40} className="text-pink-500/30 fill-pink-500/30" />
            <p className="text-lg font-bold">Catálogo vazio.</p>
            <Link href="/admin" className="text-pink-500 hover:underline text-sm">Adicionar Animes no Painel Admin</Link>
          </div>
        )}

        <div className="px-6 lg:px-14 mt-[-20px] relative z-20 space-y-10">
          {/* Trending */}
          {trendingAnimes.length > 0 && (
            <section>
              <h2 className="text-lg font-black flex items-center gap-2 mb-5 border-l-4 border-pink-500 pl-4">
                <TrendingUp size={18} className="text-pink-500" /> Em Alta
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {trendingAnimes.map((ep, i) => (
                  <Link key={ep.animeId} href={`/anime/${ep.animeId}`}
                    className="w-[130px] lg:w-[160px] shrink-0 snap-start group">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition duration-300">
                      <img src={ep.anime?.coverImage || ""} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt={ep.anime?.title || ""} />
                      <div className="absolute top-2 left-2 w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center text-xs font-black shadow">
                        {i + 1}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                        <p className="text-white font-bold text-xs truncate w-full">{ep.anime?.title}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recently Added */}
          {recentAnimes.length > 0 && (
            <section>
              <h2 className="text-lg font-black flex items-center gap-2 mb-5 border-l-4 border-pink-500 pl-4">
                <Clock size={18} className="text-pink-500" /> Adicionados Recentemente
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {recentAnimes.map(anime => (
                  <Link key={anime.id} href={`/anime/${anime.id}`}
                    className="w-[130px] lg:w-[160px] shrink-0 snap-start group">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-zinc-800 group-hover:border-pink-500 transition duration-300">
                      <img src={anime.coverImage || ""} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt={anime.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                        <div>
                          <p className="text-white font-bold text-xs truncate">{anime.title}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Play size={10} className="text-pink-400 fill-pink-400" />
                            <span className="text-xs text-zinc-400">Assistir</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 group-hover:text-white transition mt-2 truncate">{anime.title}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <SuggestionButton />
      </div>
    </AppLayout>
  );
}
