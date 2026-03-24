import AppLayout from "@/components/AppLayout";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Clock, Play } from "lucide-react";
import { redirect } from "next/navigation";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/login");

  const history = await prisma.watchHistory.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      episode: {
        include: {
          anime: { select: { id: true, title: true, coverImage: true } },
        },
      },
    },
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

        {history.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">Seu histórico está vazio.</p>
            <p className="text-sm mt-2">Comece a assistir para ver seus episódios aqui.</p>
            <Link href="/" className="mt-6 inline-block bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-2.5 rounded-full text-sm transition">
              Explorar Catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const anime = h.episode?.anime;
              const ep = h.episode;
              return (
                <Link key={h.id} href={`/watch/${ep?.id}`}
                  className="flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800 hover:border-zinc-600 rounded-xl transition group">
                  <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                    <img src={anime?.coverImage || ""} alt={anime?.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{anime?.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      T{ep?.season} • Ep {ep?.number} {ep?.title ? `— ${ep.title}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-500">{new Date(h.updatedAt).toLocaleDateString("pt-BR")}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <Play size={12} className="text-pink-500" />
                      <span className="text-xs text-pink-500 font-bold">{h.watched ? "Assistido" : `${Math.round(h.progressSec / 60)}m`}</span>
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
