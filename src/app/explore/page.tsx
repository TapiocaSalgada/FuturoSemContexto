"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect, useRef } from "react";
import { Search, Play, UserCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface SearchResult {
  animes: { id: string; title: string; coverImage?: string; status: string }[];
  users: { id: string; name: string; avatarUrl?: string }[];
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ animes: [], users: [] });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { setResults({ animes: [], users: [] }); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const hasResults = results.animes.length > 0 || results.users.length > 0;

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black mb-1">Explorar</h1>
          <p className="text-zinc-500 text-sm">Busque animes e usuários da plataforma.</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar animes, usuários..."
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-pink-500 rounded-2xl pl-11 pr-5 py-3.5 text-white text-sm focus:outline-none transition placeholder:text-zinc-600"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {!query && (
          <p className="text-zinc-600 text-sm text-center py-12">Digite algo para pesquisar...</p>
        )}

        {query && !loading && !hasResults && (
          <div className="text-center py-12 text-zinc-500">
            <p className="font-bold">Nenhum resultado para "{query}"</p>
          </div>
        )}

        {/* Anime Results — shown first/always */}
        {results.animes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Animes</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {results.animes.map(anime => (
                <Link key={anime.id} href={`/anime/${anime.id}`} className="group">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-zinc-800 group-hover:border-pink-500 transition">
                    {anime.coverImage
                      ? <Image src={anime.coverImage} alt={anime.title} fill sizes="(max-width: 768px) 100px, 150px" className="object-cover group-hover:scale-105 transition duration-300" />
                      : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Play size={24} className="text-zinc-600" /></div>
                    }
                  </div>
                  <p className="text-xs text-zinc-400 group-hover:text-white transition mt-2 truncate">{anime.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* User Results — shown only after animes */}
        {results.users.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Usuários</h2>
            <div className="space-y-2">
              {results.users.map(user => (
                <Link key={user.id} href={`/profile/${user.id}`}
                  className="flex items-center gap-4 p-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl transition group">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700 group-hover:border-pink-500 transition">
                    {user.avatarUrl
                      ? <Image src={user.avatarUrl} alt={user.name} fill sizes="40px" className="object-cover" />
                      : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><UserCircle size={20} className="text-zinc-500" /></div>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm group-hover:text-pink-500 transition">{user.name}</p>
                    <p className="text-xs text-zinc-500">Perfil público</p>
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
