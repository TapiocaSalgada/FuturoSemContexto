"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, Filter, ChevronDown } from "lucide-react";

import AppLayout from "@/components/AppLayout";
import { buildImageCandidates } from "@/lib/image-quality";

type MangaCard = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  visibility: string;
  categories?: { id: string; name: string }[];
  _count?: { chapters?: number };
};

export default function MangasPage() {
  const [items, setItems] = useState<MangaCard[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch("/api/mangas", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (alive) setError(err.message || "Erro ao carregar mangás");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 pb-28 md:pb-24 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-accent)] font-black">Biblioteca</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white mt-2 flex items-center gap-3 tracking-tight">
              <BookOpen className="text-[var(--text-accent)]" size={30} /> Mangás
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">Catálogo importado via MangaDex com foco em capítulos traduzidos.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar manga..."
              className="kdr-input pl-10 pr-4 py-3 rounded-xl"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[2/3] kdr-skeleton rounded-2xl" />
                <div className="h-3 kdr-skeleton rounded w-3/4" />
                <div className="h-2 kdr-skeleton rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-2">
            <p className="text-red-400 font-bold text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="kdr-btn-ghost text-red-400 hover:text-red-300"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-default)] glass-card p-10 text-center space-y-2">
            <BookOpen size={32} className="mx-auto text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)] text-sm font-medium">
              {query ? `Nenhum manga encontrado para "${query}"` : "Nenhum manga cadastrado."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((manga) => {
              const imageCandidates = buildImageCandidates(manga.coverImage, manga.bannerImage);
              const initialImage = imageCandidates[0] || "/logo.png";
              const encodedCandidates = imageCandidates.join("||");

              return (
                <Link
                  key={manga.id}
                  href={`/mangas/${manga.id}`}
                  className="group rounded-2xl overflow-hidden border border-[var(--border-subtle)] glass-card hover:border-[var(--border-strong)] transition-all hover:shadow-lg"
                >
                  <div className="relative aspect-[2/3] bg-[var(--bg-card)]">
                    <img
                      src={initialImage}
                      data-candidates={encodedCandidates}
                      data-candidate-index="0"
                      alt={manga.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(event) => {
                        const target = event.currentTarget;
                        const candidates = String(target.dataset.candidates || "")
                          .split("||")
                          .map((item) => item.trim())
                          .filter(Boolean);
                        const currentIndex = Number(target.dataset.candidateIndex || "0");
                        const nextIndex = Number.isFinite(currentIndex) ? currentIndex + 1 : 1;
                        if (nextIndex < candidates.length) {
                          target.dataset.candidateIndex = String(nextIndex);
                          target.src = candidates[nextIndex];
                        }
                      }}
                    />
                    {(manga._count?.chapters || 0) > 0 && (
                      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                        <span className="text-[9px] font-bold text-white uppercase">{manga._count?.chapters} cap</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-bold text-white line-clamp-2 min-h-[2.6rem]">{manga.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {(manga._count?.chapters || 0).toString()} capítulo(s)
                    </p>
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
