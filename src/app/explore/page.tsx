"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useRef } from "react";
import { Search, Play, UserCircle, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import AnimeCard from "@/components/AnimeCard";

interface SearchResult {
  animes: { id: string; title: string; coverImage?: string; status: string }[];
  mangas: { id: string; title: string; coverImage?: string }[];
  users: { id: string; name: string; avatarUrl?: string }[];
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ animes: [], mangas: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { setResults({ animes: [], mangas: [], users: [] }); setError(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        setResults({
          animes: Array.isArray(data?.animes) ? data.animes : [],
          mangas: Array.isArray(data?.mangas) ? data.mangas : [],
          users: Array.isArray(data?.users) ? data.users : [],
        });
      } catch (err: any) {
        setError(err.message || "Erro ao buscar");
        setResults({ animes: [], mangas: [], users: [] });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const hasResults = results.animes.length > 0 || results.mangas.length > 0 || results.users.length > 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 pb-28 md:pb-24 max-w-6xl mx-auto space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-accent)] font-black">Descobrir</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mt-1">Explorar</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Busque animes, mangás e usuários da plataforma.</p>
        </div>

        {/* Search Bar */}
        <div className="relative glass-surface rounded-2xl p-2 sm:p-2.5">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar animes, mangás, usuários..."
            autoFocus
            className="kdr-input pl-11 pr-5 py-3.5 rounded-xl"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          )}
        </div>

        {!query && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Sparkles size={36} className="text-[var(--text-muted)] opacity-40" />
            <p className="text-[var(--text-muted)] text-sm font-medium">Digite algo para pesquisar...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}

        {query && !loading && !hasResults && !error && (
          <div className="text-center py-16 space-y-2">
            <Search size={32} className="mx-auto text-[var(--text-muted)] opacity-40" />
            <p className="font-bold text-[var(--text-muted)]">Nenhum resultado para &quot;{query}&quot;</p>
          </div>
        )}

        {/* Anime Results */}
        {results.animes.length > 0 && (
          <section className="animate-fadeInUp">
            <h2 className="kdr-section-title mb-5"><Play size={16} className="kdr-section-title-accent" /> Animes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {results.animes.map(anime => (
                <AnimeCard
                  key={anime.id}
                  href={`/anime/${anime.id}`}
                  title={anime.title}
                  image={anime.coverImage}
                  className="w-full"
                />
              ))}
            </div>
          </section>
        )}

        {/* Manga Results */}
        {results.mangas.length > 0 && (
          <section className="animate-fadeInUp">
            <h2 className="kdr-section-title mb-5"><BookOpen size={16} className="kdr-section-title-accent" /> Mangás</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {results.mangas.map(manga => (
                <AnimeCard
                  key={manga.id}
                  href={`/mangas/${manga.id}`}
                  title={manga.title}
                  image={manga.coverImage}
                  className="w-full"
                />
              ))}
            </div>
          </section>
        )}

        {/* User Results */}
        {results.users.length > 0 && (
          <section className="animate-fadeInUp">
            <h2 className="kdr-section-title mb-5"><UserCircle size={16} className="kdr-section-title-accent" /> Usuários</h2>
            <div className="space-y-2">
              {results.users.map(user => (
                <Link key={user.id} href={`/profile/${user.id}`}
                  className="flex items-center gap-4 p-3.5 sm:p-3 glass-card hover:bg-white/[0.06] rounded-xl transition group min-h-[56px]">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-[var(--border-default)] group-hover:border-[var(--accent-border)] transition">
                    {user.avatarUrl
                      ? <Image src={user.avatarUrl} alt={user.name} fill sizes="40px" className="object-cover" />
                      : <div className="w-full h-full bg-[var(--bg-card)] flex items-center justify-center"><UserCircle size={20} className="text-[var(--text-muted)]" /></div>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm group-hover:text-[var(--text-accent)] transition">{user.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">Perfil público</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
