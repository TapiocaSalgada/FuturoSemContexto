"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Play, Trash2 } from "lucide-react";

import AppLayout from "@/components/AppLayout";

type HistoryItem = {
  id: string;
  progressSec: number;
  watched: boolean;
  updatedAt: string;
  episodeId: string;
  episode?: {
    id: string;
    number: number;
    season: number;
    title?: string;
    thumbnailUrl?: string | null;
    anime?: {
      id: string;
      title: string;
      coverImage?: string | null;
      bannerImage?: string | null;
      visibility?: string;
    };
  };
};

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") loadHistory();
  }, [status, router]);

  const uniqueHistory = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    for (const item of history) {
      const animeId = item.episode?.anime?.id;
      const visibility = item.episode?.anime?.visibility;
      if (!animeId) continue;
      if (visibility && visibility !== "public") continue;
      if (!map.has(animeId)) map.set(animeId, item);
    }
    return Array.from(map.values());
  }, [history]);

  const removeByAnime = async (animeId: string) => {
    await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId }),
    });
    await loadHistory();
  };

  const clearAll = async () => {
    if (!confirm("Deseja limpar todo o histórico?")) return;
    setClearing(true);
    await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await loadHistory();
    setClearing(false);
  };

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-10 pb-24 max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded-lg bg-zinc-900 animate-pulse" />
            <div className="h-4 w-80 max-w-full rounded bg-zinc-900/80 animate-pulse" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`history-skeleton-${idx}`} className="flex items-center gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                <div className="w-24 h-14 sm:w-28 sm:h-16 rounded-xl bg-zinc-800 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-zinc-800 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-zinc-800/80 animate-pulse" />
                </div>
                <div className="h-7 w-7 rounded-lg bg-zinc-800 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight flex items-center gap-3 flex-wrap">
              <Clock className="kdr-section-title-accent" size={30} />
              Historico de Episodios
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Todos os episódios assistidos. Você pode remover itens ou limpar tudo.</p>
          </div>
          <button
            onClick={clearAll}
            disabled={clearing || uniqueHistory.length === 0}
            className="w-full sm:w-auto px-4 py-2 rounded-full text-xs font-black uppercase bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            {clearing ? "Limpando..." : "Limpar histórico"}
          </button>
        </div>

        {uniqueHistory.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">Seu histórico está vazio.</p>
            <p className="text-sm mt-2">Comece a assistir para ver seus episódios aqui.</p>
            <Link prefetch={true} href="/" className="mt-6 inline-block bg-white hover:bg-zinc-100 text-black font-black px-6 py-2.5 rounded-full text-sm transition shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              Explorar catálogo
            </Link>
          </div>
        ) : (
            <div className="space-y-2.5">
              {uniqueHistory.map((h) => {
              const anime = h.episode?.anime;
              const ep = h.episode;
              if (!anime || !ep) return null;
              return (
                <div key={h.id} className="flex items-center gap-4 p-4 glass-card border border-white/10 rounded-2xl">
                  <Link prefetch={true} href={`/watch/${ep.id}`} className="flex items-center gap-4 min-w-0 flex-1 group">
                    <div className="relative w-24 h-14 sm:w-28 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                      <Image src={ep.thumbnailUrl || anime.bannerImage || anime.coverImage || "/logo.png"} alt={anime.title} fill sizes="(max-width: 768px) 100px, 150px" className="object-cover group-hover:scale-110 transition duration-500" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_14px_rgba(255,255,255,0.35)]">
                          <Play size={14} className="ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm sm:text-base truncate group-hover:text-zinc-200 transition-colors">{anime.title}</p>
                      <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 truncate">T{ep.season} • Ep {ep.number} {ep.title ? `— ${ep.title}` : ""}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{new Date(h.updatedAt).toLocaleDateString("pt-BR")}</p>
                    <button
                      onClick={() => removeByAnime(anime.id)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Remover do histórico"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
