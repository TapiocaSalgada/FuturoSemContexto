import AppLayout from "@/components/AppLayout";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { Clock, Play } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";


export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const userId = (session.user as any).id;
  if (!userId) redirect("/login");
  const isAdmin = (session.user as any)?.role === "admin";

  const history = await prisma.watchHistory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      episode: {
        include: {
          anime: { select: { id: true, title: true, coverImage: true, bannerImage: true, visibility: true } },
        },
      },
    },
  });

  // Mostrar somente o item mais recente por anime
  const uniqueHistory = Array.from(
    history.reduce((map, item) => {
      const animeId = item.episode?.anime?.id;
      if (!animeId) return map;
      if (!map.has(animeId)) map.set(animeId, item);
      return map;
    }, new Map<string, typeof history[number]>()).values()
  ).filter((item) => {
    const visibility = item.episode?.anime?.visibility;
    return visibility === "public" || isAdmin;
  });

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Clock className="text-pink-500" size={28} />
            Histórico de <span className="text-pink-500">Episódios</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Todos os episódios que você assistiu, em ordem.</p>
        </div>

        {uniqueHistory.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">Seu histórico está vazio.</p>
            <p className="text-sm mt-2">Comece a assistir para ver seus episódios aqui.</p>
            <Link prefetch={true} href="/" className="mt-6 inline-block bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-2.5 rounded-full text-sm transition shadow-[0_0_20px_rgba(255,0,127,0.4)]">
              Explorar Catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {uniqueHistory.map((h) => {
              const anime = h.episode?.anime;
              const ep = h.episode;
              return (
                <Link prefetch={true} key={h.id} href={`/watch/${ep?.id}`}
                  className="flex items-center gap-4 p-4 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-pink-500 rounded-2xl transition-all duration-300 group hover:shadow-[0_0_20px_rgba(255,0,127,0.15)]">
                   <div className="relative w-24 h-14 sm:w-28 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                     <Image src={h.episode?.thumbnailUrl || anime?.bannerImage || anime?.coverImage || "https://via.placeholder.com/300x200?text=?"} alt={anime?.title || "Capa"} fill sizes="(max-width: 768px) 100px, 150px" className="object-cover group-hover:scale-110 transition duration-500 opacity-90 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                       <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-[0_0_10px_rgba(255,0,127,0.8)]">
                         <Play size={14} className="ml-0.5" fill="currentColor" />
                       </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm sm:text-base truncate group-hover:text-pink-400 transition-colors drop-shadow-md">{anime?.title}</p>
                    <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 truncate">
                      T{ep?.season} • Ep {ep?.number} {ep?.title ? `— ${ep.title}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{new Date(h.updatedAt).toLocaleDateString("pt-BR")}</p>
                    <div className="flex items-center gap-1.5 mt-2 justify-end">
                      {h.watched ? (
                        <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-400 text-[10px] font-black uppercase tracking-wider border border-pink-500/30 shadow-[0_0_10px_rgba(255,0,127,0.1)]">Concluído</span>
                      ) : (
                        <span className="text-xs text-zinc-300 font-bold bg-zinc-800 px-2 py-0.5 rounded-md">
                          {Math.round(h.progressSec / 60)}m
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
