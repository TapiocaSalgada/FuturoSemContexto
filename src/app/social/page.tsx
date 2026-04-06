"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film, Star, Users, RefreshCw } from "lucide-react";

import AppLayout from "@/components/AppLayout";

type FeedItem = {
  id: string;
  type: "watch" | "rating";
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  anime: { id: string; title: string; coverImage?: string | null };
  episode?: { id: string; number: number; season: number };
  rating?: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SocialFeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const watches = items.filter((i) => i.type === "watch").length;
    const ratings = items.filter((i) => i.type === "rating").length;
    return { watches, ratings };
  }, [items]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-10 pb-28 md:pb-24 max-w-6xl mx-auto space-y-6">
        <header className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
              <Users size={24} className="kdr-section-title-accent" /> Social
            </h1>
            <button
              onClick={load}
              className="px-4 py-2 rounded-full glass-surface hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition flex items-center gap-2"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="glass-card rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Eventos</p>
              <p className="text-sm font-black text-white">{items.length}</p>
            </div>
            <div className="glass-card rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Assistidos</p>
              <p className="text-sm font-black text-white">{summary.watches}</p>
            </div>
            <div className="glass-card rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Notas</p>
              <p className="text-sm font-black text-white">{summary.ratings}</p>
            </div>
            <div className="glass-card rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Ativos</p>
              <p className="text-sm font-black text-white">{new Set(items.map((i) => i.user.id)).size}</p>
            </div>
          </div>
        </header>

        <section className="space-y-3 max-w-3xl mx-auto w-full">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={`feed-skeleton-${idx}`} className="rounded-2xl border border-white/10 glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-zinc-800 animate-pulse" />
                      <div className="h-4 w-3/4 rounded bg-zinc-800/80 animate-pulse" />
                    </div>
                    <div className="w-12 h-16 rounded-lg bg-zinc-800 animate-pulse shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 rounded-2xl border border-white/10 glass-card text-center space-y-2">
              <p className="text-zinc-300 font-bold">Sem atividade ainda</p>
              <p className="text-zinc-500 text-sm">Siga pessoas para ver o feed social.</p>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 glass-card p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/profile/${item.user.id}`} className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/15">
                    <Image
                      src={item.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}&background=333&color=fff`}
                      alt={item.user.name}
                      fill
                      className="object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${item.user.id}`} className="font-bold text-white hover:text-zinc-200 transition text-sm">
                        {item.user.name}
                      </Link>
                      <span className="text-[11px] text-zinc-600">{formatDate(item.createdAt)}</span>
                    </div>

                    <div className="mt-1 text-sm text-zinc-300 flex flex-wrap items-center gap-2">
                      {item.type === "watch" ? (
                        <>
                          <Film size={14} className="kdr-section-title-accent" />
                          <span>
                            assistiu <strong className="text-white">T{item.episode?.season} E{item.episode?.number}</strong> de
                          </span>
                        </>
                      ) : (
                        <>
                          <Star size={14} className="text-yellow-400" />
                          <span>
                            avaliou com <strong className="text-white">{item.rating}/5</strong>
                          </span>
                        </>
                      )}
                      <Link href={`/anime/${item.anime.id}`} className="kdr-section-title-accent hover:text-white font-bold break-words leading-snug max-w-full">
                        {item.anime.title}
                      </Link>
                    </div>
                  </div>

                  <Link href={`/anime/${item.anime.id}`} className="w-12 h-16 rounded-lg overflow-hidden border border-zinc-700 shrink-0 relative">
                    <Image
                      src={item.anime.coverImage || "/logo.png"}
                      alt={item.anime.title}
                      fill
                      className="object-cover"
                    />
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </AppLayout>
  );
}
