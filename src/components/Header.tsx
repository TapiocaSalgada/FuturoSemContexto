"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Megaphone, LogOut, UserCircle, Settings, X, ChevronDown } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function Header() {
  const { data: session } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const announcementRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/announcements").then(r => r.json()).then(data => {
      setAnnouncements(data);
      // Check if there are unread announcements
      const lastRead = (session?.user as any)?.lastReadAnnouncements;
      if (data.length > 0 && (!lastRead || new Date(lastRead) < new Date(data[0].createdAt))) {
        setHasUnread(true);
      }
    });
  }, [session]);

  const handleOpenAnnouncements = () => {
    setShowAnnouncements(!showAnnouncements);
    if (!showAnnouncements && hasUnread) {
      // Mark as read
      fetch("/api/announcements/read", { method: "POST" });
      setHasUnread(false);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (announcementRef.current && !announcementRef.current.contains(e.target as Node)) setShowAnnouncements(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session) return null;

  const avatarUrl = (session.user as any)?.avatarUrl || session.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user?.name || "U")}&background=ff007f&color=fff`;

  return (
    <header className="flex items-center justify-end gap-3 px-6 py-3 bg-[#0d0d0d]/80 backdrop-blur-sm border-b border-white/5 fixed top-0 right-0 z-30" style={{ left: "var(--sidebar-width, 4rem)" }}>
      {/* Announcements Bell */}
      <div className="relative" ref={announcementRef}>
        <button
          onClick={handleOpenAnnouncements}
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-pink-500 hover:bg-zinc-800 transition"
          title="Anúncios"
        >
          <Megaphone size={20} />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0d0d0d] animate-pulse" />
          )}
        </button>

        {showAnnouncements && (
          <div className="absolute right-0 top-14 w-80 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Megaphone size={14} className="text-pink-500" /> Anúncios
              </h3>
              <button onClick={() => setShowAnnouncements(false)} className="text-zinc-500 hover:text-white transition">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {announcements.length === 0 ? (
                <p className="text-zinc-500 text-sm p-4 text-center">Nenhum anúncio ainda.</p>
              ) : (
                announcements.map(a => (
                  <div key={a.id} className="px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition">
                    <p className="font-bold text-white text-sm">{a.title}</p>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{a.content}</p>
                    <p className="text-zinc-600 text-xs mt-2">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile Dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2 hover:opacity-90 transition"
          title="Perfil"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-pink-500/50 hover:border-pink-500 transition shadow-[0_0_10px_rgba(255,0,127,0.2)]">
            <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
          </div>
          <ChevronDown size={14} className={`text-zinc-400 transition ${showProfile ? "rotate-180" : ""}`} />
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
                <UserCircle size={16} className="text-pink-500" /> Ver Perfil
              </Link>
              <Link href="/settings" onClick={() => setShowProfile(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition">
                <Settings size={16} className="text-pink-500" /> Configurações
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
    </header>
  );
}
