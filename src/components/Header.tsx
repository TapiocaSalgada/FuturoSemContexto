"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, LogOut, UserCircle, Settings, X, ChevronDown, Search } from "lucide-react";

interface Announcement { id: string; title: string; content: string; createdAt: string; }
interface SearchResult { animes: { id: string; title: string; coverImage?: string }[]; users: { id: string; name: string; avatarUrl?: string }[]; }

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const announcementRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/announcements").then(r => r.json()).then(data => {
      setAnnouncements(data);
      const lastRead = localStorage.getItem("lastReadAnnouncements");
      if (data.length > 0 && (!lastRead || new Date(lastRead) < new Date(data[0].createdAt))) {
        setHasUnread(true);
      }
    });
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults(null); setSearchOpen(false); return; }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
      setSearchOpen(true);
    }, 250);
  }, []);

  const handleOpenAnnouncements = () => {
    setShowAnnouncements(!showAnnouncements);
    if (!showAnnouncements && hasUnread) {
      fetch("/api/announcements/read", { method: "POST" });
      localStorage.setItem("lastReadAnnouncements", new Date().toISOString());
      setHasUnread(false);
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (announcementRef.current && !announcementRef.current.contains(e.target as Node)) setShowAnnouncements(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session) return null;
  const avatarUrl = (session.user as any)?.avatarUrl || session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || "U")}&background=ff007f&color=fff`;
  const unreadCount = announcements.length;

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 fixed top-0 right-0 z-30 left-0 md:left-16 lg:left-60 h-14">
      {/* Spacer for mobile hamburger */}
      <div className="md:hidden w-12 shrink-0" />

      {/* Search Bar */}
      <div className="flex-1 max-w-sm relative" ref={searchRef}>
        <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 focus-within:border-pink-500 rounded-xl px-3 py-2 transition">
          <Search size={15} className="text-zinc-500 shrink-0" />
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => query && setSearchOpen(true)}
            placeholder="Pesquisar animes, pessoas..."
            className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder:text-zinc-600 min-w-0"
          />
          {query && <button onClick={() => { setQuery(""); setSearchResults(null); setSearchOpen(false); }}><X size={13} className="text-zinc-500 hover:text-white transition" /></button>}
        </div>

        {/* Search Dropdown */}
        {searchOpen && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
            {searchResults.animes.length === 0 && searchResults.users.length === 0 ? (
              <p className="text-zinc-500 text-sm p-4 text-center">Nenhum resultado encontrado.</p>
            ) : (
              <>
                {searchResults.animes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-4 py-2 border-b border-zinc-800">Animes</p>
                    {searchResults.animes.map(a => (
                      <Link key={a.id} href={`/anime/${a.id}`} onClick={() => { setSearchOpen(false); setQuery(""); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition">
                        <div className="w-9 h-12 rounded overflow-hidden shrink-0 bg-zinc-800">
                          {a.coverImage && <img src={a.coverImage} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <p className="text-sm text-white font-semibold truncate">{a.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.users.length > 0 && (
                  <div className={searchResults.animes.length > 0 ? "border-t border-zinc-800" : ""}>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-4 py-2 border-b border-zinc-800">Perfis</p>
                    {searchResults.users.map(u => (
                      <Link key={u.id} href={`/profile/${u.id}`} onClick={() => { setSearchOpen(false); setQuery(""); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition">
                        <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=333&color=fff`}
                          className="w-8 h-8 rounded-full shrink-0 object-cover" alt={u.name} />
                        <p className="text-sm text-white font-semibold">{u.name}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right corner: Bell + Profile */}
      <div className="ml-auto flex items-center gap-2 shrink-0">

      {/* Announcements Bell */}
      <div className="relative" ref={announcementRef}>
        <button onClick={handleOpenAnnouncements}
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-pink-500 hover:bg-zinc-800 transition"
          title="Anúncios">
          <Megaphone size={19} />
          {hasUnread && (
            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0d0d0d] animate-pulse flex items-center justify-center">
              <span className="text-[7px] font-black text-white leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
            </span>
          )}
        </button>
        {showAnnouncements && (
          <div className="absolute right-0 top-14 w-80 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2"><Megaphone size={14} className="text-pink-500" /> Anúncios</h3>
              <button onClick={() => setShowAnnouncements(false)} className="text-zinc-500 hover:text-white transition"><X size={14} /></button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {announcements.length === 0
                ? <p className="text-zinc-500 text-sm p-4 text-center">Nenhum anúncio ainda.</p>
                : announcements.map(a => (
                  <div key={a.id} className="px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition">
                    <p className="font-bold text-white text-sm">{a.title}</p>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{a.content}</p>
                    <p className="text-zinc-600 text-xs mt-2">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Profile Dropdown */}
      <div className="relative shrink-0" ref={profileRef}>
        <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 hover:opacity-90 transition" title="Perfil">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-pink-500/50 hover:border-pink-500 transition shadow-[0_0_10px_rgba(255,0,127,0.2)]">
            <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
          </div>
          <ChevronDown size={14} className={`text-zinc-400 transition hidden sm:block ${showProfile ? "rotate-180" : ""}`} />
        </button>
        {showProfile && (
          <div className="absolute right-0 top-14 w-56 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="font-bold text-white text-sm truncate">{session.user?.name}</p>
              <p className="text-zinc-500 text-xs truncate">{session.user?.email}</p>
            </div>
            <div className="py-1">
              <Link href="/profile" onClick={() => setShowProfile(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition">
                <UserCircle size={16} className="text-pink-500" /> Meu Perfil
              </Link>
              <Link href="/settings" onClick={() => setShowProfile(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition">
                <Settings size={16} className="text-pink-500" /> Editar Usuário
              </Link>
            </div>
            <div className="border-t border-zinc-800 py-1">
              <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-red-400 hover:bg-red-500/10 transition">
                <LogOut size={16} /> Sair da Conta
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
