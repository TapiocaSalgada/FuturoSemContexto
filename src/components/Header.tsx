"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Bell,
  LogOut,
  Play,
  Search,
  UserCircle,
  UserPlus,
  X,
} from "lucide-react";

interface SearchResult {
  animes: { id: string; title: string; coverImage?: string }[];
  users: { id: string; name: string; avatarUrl?: string }[];
}

interface NotificationItem {
  id: string;
  type: "announcement" | "follow" | "comment_reply" | "new_episode";
  title: string;
  body?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
  actor?: { id: string; name: string; avatarUrl?: string } | null;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function NotificationGlyph({ type }: { type: NotificationItem["type"] }) {
  if (type === "follow") return <UserPlus size={14} className="text-sky-400" />;
  if (type === "new_episode") return <Play size={14} className="text-green-400" />;
  return <Bell size={14} className="text-pink-400" />;
}

export default function Header() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=20");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications || []);
    setUnreadCount(data.unreadCount || 0);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 45000);
    return () => clearInterval(interval);
  }, [session, loadNotifications]);

  const handleSearch = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    clearTimeout(searchTimeout.current);

    if (!nextQuery.trim()) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(nextQuery)}`);
      const data = await res.json();
      setSearchResults(data);
      setSearchOpen(true);
    }, 250);
  }, []);

  const handleOpenNotifications = async () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);
    if (willOpen && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      );
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    }
  };

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session) return null;

  const displayAvatar =
    session?.user?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      session?.user?.name || "U",
    )}&background=ff007f&color=fff`;

  return (
    <header className="fixed top-0 left-0 md:left-16 lg:left-60 right-0 h-14 z-30 flex items-center px-3 md:px-5 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="md:hidden w-11 shrink-0" />

        <div className="flex-1 max-w-xs sm:max-w-sm relative" ref={searchRef}>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 focus-within:border-pink-500/70 rounded-xl px-3 py-2 transition">
            <Search size={14} className="text-zinc-500 shrink-0" />
            <input
              value={query}
              onChange={(event) => handleSearch(event.target.value)}
              onFocus={() => query && setSearchOpen(true)}
              placeholder="Buscar anime ou perfil..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder:text-zinc-600 min-w-0 w-full"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSearchResults(null);
                  setSearchOpen(false);
                }}
              >
                <X size={12} className="text-zinc-500 hover:text-white transition" />
              </button>
            )}
          </div>

          {searchOpen && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              {searchResults.animes.length === 0 &&
              searchResults.users.length === 0 ? (
                <p className="text-zinc-500 text-sm p-4 text-center">
                  Nenhum resultado.
                </p>
              ) : (
                <>
                  {searchResults.animes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-4 py-2 border-b border-zinc-800">
                        Animes
                      </p>
                      {searchResults.animes.map((anime) => (
                        <Link
                          key={anime.id}
                          href={`/anime/${anime.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            setQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition"
                        >
                          <div className="w-8 h-11 rounded overflow-hidden shrink-0 bg-zinc-800">
                            {anime.coverImage && (
                              <img
                                src={anime.coverImage}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            )}
                          </div>
                          <p className="text-sm text-white font-semibold truncate">
                            {anime.title}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.users.length > 0 && (
                    <div
                      className={
                        searchResults.animes.length > 0
                          ? "border-t border-zinc-800"
                          : ""
                      }
                    >
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-4 py-2 border-b border-zinc-800">
                        Perfis
                      </p>
                      {searchResults.users.map((user) => (
                        <Link
                          key={user.id}
                          href={`/profile/${user.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            setQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition"
                        >
                          <img
                            src={
                              user.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                user.name,
                              )}&background=333&color=fff`
                            }
                            className="w-7 h-7 rounded-full shrink-0 object-cover"
                            alt={user.name}
                          />
                          <p className="text-sm text-white font-semibold">
                            {user.name}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pl-3">
        <div className="relative" ref={notificationRef}>
          <button
            onClick={handleOpenNotifications}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-pink-400 hover:bg-zinc-800/80 transition"
            title="Notificacoes"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-[#0d0d0d] text-[10px] font-black text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="font-bold text-sm text-white">Central</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-zinc-500 text-sm p-4 text-center">
                    Nenhuma notificacao ainda.
                  </p>
                ) : (
                  notifications.map((notification) => {
                    const content = (
                      <div
                        className={`px-4 py-3 border-b border-zinc-800/50 last:border-0 transition ${
                          notification.isRead ? "bg-transparent" : "bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                            {notification.actor?.avatarUrl ? (
                              <img
                                src={notification.actor.avatarUrl}
                                alt={notification.actor.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <NotificationGlyph type={notification.type} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white leading-tight">
                              {notification.title}
                            </p>
                            {notification.body && (
                              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                {notification.body}
                              </p>
                            )}
                            <p className="text-[11px] text-zinc-600 mt-1">
                              {formatNotificationDate(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );

                    if (notification.link) {
                      return (
                        <Link
                          key={notification.id}
                          href={notification.link}
                          onClick={() => setShowNotifications(false)}
                        >
                          {content}
                        </Link>
                      );
                    }

                    return <div key={notification.id}>{content}</div>;
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile((value) => !value)}
            className="flex items-center gap-1.5 hover:opacity-90 transition pl-1"
            title="Perfil"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-pink-500/60 hover:border-pink-400 transition shadow-[0_0_8px_rgba(255,0,127,0.25)]">
              <img
                src={displayAvatar}
                className="w-full h-full object-cover"
                alt="avatar"
                key={displayAvatar}
              />
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 w-52 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="font-bold text-white text-sm truncate">
                  {session.user?.name}
                </p>
                <p className="text-zinc-500 text-xs truncate">
                  {session.user?.email}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  <UserCircle size={15} className="text-pink-500" /> Meu Perfil
                </Link>
              </div>
              <div className="border-t border-zinc-800 py-1">
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut size={15} /> Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
