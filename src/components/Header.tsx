"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Clock3,
  Heart,
  LogOut,
  MessageCircle,
  Play,
  Search,
  Settings2,
  Shield,
  UserCircle,
  UserPlus,
  X,
} from "lucide-react";

import { readSavedAccounts } from "@/lib/saved-accounts";

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

type NavigationState = {
  canAccessAnimeTab?: boolean;
  };

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
  if (type === "new_episode") return <Play size={14} className="text-emerald-400" />;
  return <Bell size={14} className="text-[var(--text-accent)]" />;
}

export default function Header({ cinematic = false }: { cinematic?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<NavigationState>({});
  const [savedAccounts, setSavedAccounts] = useState<
    { email: string; name: string; avatar?: string }[]
  >([]);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let alive = true;
    fetch("/api/system/navigation", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setNavigation({
          canAccessAnimeTab: Boolean(data.canAccessAnimeTab),
                  });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      const filtered = (data.notifications || []).filter((n: any) => n.type !== "ad");
      setNotifications(filtered);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let alive = true;

    const connection = (navigator as any)?.connection;
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || "").toLowerCase();
    const isConstrainedNetwork =
      saveData ||
      effectiveType.includes("slow-2g") ||
      effectiveType.includes("2g") ||
      effectiveType.includes("3g");
    const pollMs = isConstrainedNetwork ? 120000 : 75000;

    const safeLoad = async () => {
      if (!alive) return;
      if (document.hidden) return;
      await loadNotifications();
    };

    safeLoad();
    const interval = setInterval(safeLoad, pollMs);
    const onFocus = () => {
      void safeLoad();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [session, loadNotifications]);

  const handleSearch = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!nextQuery.trim()) {
      setSearchResults(null);
      setSearchOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(nextQuery)}`);
        if (!res.ok) throw new Error("Erro");
        const data = await res.json();
        setSearchResults({
          animes: Array.isArray(data?.animes) ? data.animes : [],
                    users: Array.isArray(data?.users) ? data.users : [],
        });
        setSearchOpen(true);
      } catch (e) {
        setSearchResults({ animes: [], users: [] });
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleOpenNotifications = async () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);
    setShowProfile(false);
    if (willOpen && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      );
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAllRead: true }),
        });
      } catch {
        // Silently fail
      }
    }
  };

  const loadSavedAccounts = useCallback(() => {
    const currentEmail = String(session?.user?.email || "").trim().toLowerCase();
    const saved = readSavedAccounts(8);

    setSavedAccounts(
      saved
        .filter((item) => item.email !== currentEmail)
        .map((item) => ({
          email: item.email,
          name: item.name || item.email,
          avatar: item.avatar,        })),
    );
  }, [session?.user?.email]);

  const handleOpenAccountSwitcher = () => {
    loadSavedAccounts();
    setShowProfile(false);
    setShowAccountSwitcher(true);
  };

  const handleQuickSwitchAccount = async (account: { email: string }) => {
    if (!account.email) return;
    setSwitchingEmail(account.email);

    try {
      await signOut({ callbackUrl: `/login?email=${encodeURIComponent(account.email)}` });
    } finally {
      setSwitchingEmail(null);
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
        if (window.innerWidth < 768) {
          setSearchExpanded(false);
        }
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setSearchExpanded(false);
      setShowNotifications(false);
      setShowProfile(false);
      setShowAccountSwitcher(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    setShowNotifications(false);
    setShowProfile(false);
    setSearchOpen(false);
    setSearchExpanded(false);
  }, [pathname]);

  if (!session) return null;

  const displayAvatar =
    session?.user?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      session?.user?.name || "U",
    )}&background=334155&color=fff`;

  const canAccessAnimeTab = navigation.canAccessAnimeTab ?? true;
  const isAdmin = (session?.user as any)?.role === "admin";
  const navLinks = [
    ...(canAccessAnimeTab ? [{ href: "/", label: "Inicio" }] : []),
    { href: "/explore", label: "Explorar" },
    { href: "/favorites", label: "Favoritos" },
    { href: "/settings", label: "Configurações" },
  ];

  return (
    <header
      className="kdr-header fixed inset-x-0 top-0 z-40 px-2 sm:px-4 lg:px-6"
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${cinematic ? "4px" : "6px"})`,
      }}
    >
      <div className={`kdr-topbar pointer-events-auto mx-auto flex ${cinematic ? "h-[50px]" : "h-[56px]"} max-w-[1580px] items-center gap-2 rounded-2xl ${cinematic ? "px-2 sm:px-2.5 md:px-3" : "px-2.5 sm:px-3 md:px-4"}`}>
        {/* Logo */}
        <div className="hidden md:flex items-center gap-2 mr-1">
          <Link prefetch={true} href="/" className="inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10 transition">
            <Image src="/logo.png" alt="Futuro sem Contexto" width={24} height={24} className="rounded-md object-cover" />
            <span className={`font-black tracking-tight text-[var(--text-primary)] ${cinematic ? "text-xs lg:text-sm" : "text-sm"} hidden lg:inline`}>Futuro</span>
          </Link>
        </div>

        {/* Nav Links - Desktop */}
        <nav className={`${cinematic ? "hidden md:flex" : "hidden lg:flex"} items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 px-1 py-0.5`}>
          {navLinks.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                prefetch={true}
                key={item.href}
                href={item.href}
                className={`kdr-nav-link ${active ? "kdr-nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={`${cinematic ? "hidden md:block" : "hidden lg:block"} kdr-topbar-divider`} />

        {/* Search + Right actions */}
        <div className={`flex items-center gap-2 flex-1 min-w-0 ${cinematic ? "justify-end" : "justify-end lg:justify-start"}`}>
          {/* Search */}
          <div className="flex-1 max-w-full sm:max-w-md relative" ref={searchRef}>
            {searchExpanded && (
              <button
                type="button"
                className="fixed inset-0 z-[65] bg-black/55 md:hidden"
                aria-label="Fechar busca"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchExpanded(false);
                }}
              />
            )}

            {/* Mobile: icon button */}
            <button
              className={`md:hidden w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] transition ${searchExpanded ? "hidden" : ""}`}
              onClick={() => {
                setSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
            >
              <Search size={18} />
            </button>

            {/* Search bar */}
            <div
              className={`${searchExpanded ? "fixed inset-x-0 top-0 z-[70] flex px-3 bg-[var(--glass-bg-heavy)] border-b border-[var(--border-default)] backdrop-blur-xl" : "hidden"} md:relative md:z-auto md:h-auto md:px-3.5 md:bg-[var(--glass-bg)] md:border-[var(--border-default)] md:border md:flex items-center gap-2 hover:border-[var(--border-strong)] focus-within:border-[var(--accent-border)] rounded-none md:rounded-full py-2.5 md:py-2 transition`}
              style={
                searchExpanded
                  ? {
                      height: "calc(56px + env(safe-area-inset-top, 0px))",
                      paddingTop: "env(safe-area-inset-top, 0px)",
                    }
                  : undefined
              }
            >
              <Search size={15} className={searching ? "text-[var(--text-accent)] animate-pulse" : "text-[var(--text-muted)]"} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => handleSearch(event.target.value)}
                onFocus={() => query && setSearchOpen(true)}
                placeholder="Buscar anime ou perfil..."
                className="bg-transparent text-[var(--text-primary)] text-[15px] md:text-sm flex-1 focus:outline-none placeholder:text-[var(--text-muted)] min-w-0 w-full"
              />
              {(query || searchExpanded) && (
                <button
                  className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-white/10"
                  onClick={() => {
                    setQuery("");
                    setSearchResults(null);
                    setSearchOpen(false);
                    setSearching(false);
                    setSearchExpanded(false);
                  }}
                >
                  <X size={12} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {searchOpen && (
                <div className={`${searchExpanded ? "fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+56px)] rounded-t-none" : "absolute top-full left-0 right-0 mt-2"} md:absolute md:top-full md:left-0 md:right-0 md:mt-2 glass-surface-heavy border border-white/12 rounded-2xl shadow-2xl overflow-hidden z-[75] max-h-[min(56vh,22rem)] overflow-y-auto animate-scaleIn`}>
                {searching ? (
                  <div className="p-8 flex flex-col items-center justify-center gap-3">
                    <div className="kdr-spinner" />
                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Buscando...</p>
                  </div>
                ) :
                  !searchResults ||
                  (searchResults.animes.length === 0 &&
                    searchResults.users.length === 0) ? (
                  <p className="text-[var(--text-muted)] text-sm p-6 text-center">
                    Nenhum resultado encontrado.
                  </p>
                ) : (
                  <>
                    {searchResults.animes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider px-4 py-2.5 border-b border-[var(--border-subtle)]">
                          Animes
                        </p>
                        {searchResults.animes.map((anime) => (
                          <Link
                            prefetch={true}
                            key={anime.id}
                            href={`/anime/${anime.id}`}
                            onClick={() => {
                              setSearchOpen(false);
                              setQuery("");
                              setSearchExpanded(false);
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition"
                          >
                            <div className="w-9 h-12 rounded-lg overflow-hidden shrink-0 bg-[var(--bg-card)] relative border border-[var(--border-subtle)]">
                              {anime.coverImage && (
                                <Image
                                  src={anime.coverImage}
                                  fill
                                  sizes="36px"
                                  className="object-cover"
                                  alt=""
                                />
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-primary)] font-semibold truncate">
                              {anime.title}
                            </p>
	                          </Link>
	                        ))}
	                      </div>
	                    )}
	                    {searchResults.users.length > 0 && (
	                      <div className={searchResults.animes.length > 0 ? "border-t border-[var(--border-subtle)]" : ""}>
	                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider px-4 py-2.5 border-b border-[var(--border-subtle)]">
	                          Perfis
                        </p>
                        {searchResults.users.map((user) => (
                          <Link
                            prefetch={true}
                            key={user.id}
                            href={`/profile/${user.id}`}
                            onClick={() => {
                              setSearchOpen(false);
                              setQuery("");
                              setSearchExpanded(false);
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition"
                          >
                            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
                                <Image
                                  src={
                                    user.avatarUrl ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      user.name,
                                    )}&background=333&color=fff`
                                  }
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                  alt={user.name}
                                />
                            </div>
                            <p className="text-sm text-[var(--text-primary)] font-semibold">
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

        {/* Right side actions */}
        <div className={`flex items-center gap-1.5 shrink-0 pl-1 rounded-full border border-white/12 bg-[var(--glass-bg)] backdrop-blur-md px-1.5 py-1 ${searchExpanded ? "hidden md:flex" : "flex"}`}>
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={handleOpenNotifications}
              className="relative w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition"
              title="Notificacoes"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center"
                  style={{ backgroundColor: "var(--accent)", boxShadow: `0 0 8px var(--accent-glow)` }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications panel */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 bg-black/60 z-40 md:hidden"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="fixed left-2 right-2 top-[calc(env(safe-area-inset-top,0px)+62px)] z-50 w-auto md:absolute md:left-auto md:right-0 md:top-12 md:w-[min(22rem,calc(100vw-1rem))] glass-surface-heavy border border-white/12 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn max-h-[min(72vh,36rem)]">
                  <div className="flex items-center justify-between px-5 py-4 md:px-4 md:py-3 border-b border-[var(--border-subtle)]">
                    <h3 className="font-black text-base md:text-sm text-[var(--text-primary)]">Central</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Bell size={28} className="text-[var(--text-muted)]" />
                        <p className="text-[var(--text-muted)] text-sm font-medium">
                          Nenhuma notificacao ainda.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const content = (
                          <div
                            className={`px-5 md:px-4 py-3.5 md:py-3 border-b border-[var(--border-subtle)] last:border-0 transition ${
                              notification.isRead ? "bg-transparent" : "bg-[var(--accent-soft)]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 relative overflow-hidden">
                                {notification.actor?.avatarUrl ? (
                                  <Image
                                    src={notification.actor.avatarUrl}
                                    alt={notification.actor.name}
                                    fill
                                    sizes="36px"
                                    className="object-cover rounded-full"
                                  />
                                ) : (
                                  <NotificationGlyph type={notification.type} />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[var(--text-primary)] leading-tight break-words">
                                  {notification.title}
                                </p>
                                {notification.body && (
                                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed break-words">
                                    {notification.body}
                                  </p>
                                )}
                                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                  {formatNotificationDate(notification.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );

                        if (notification.link) {
                          return (
                            <Link
                              prefetch={true}
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
              </>
            )}
          </div>

          <a
            href="https://discord.gg/z2DRmZSHNy"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition"
            title="Discord"
            aria-label="Abrir Discord"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 127.14 96.36" aria-hidden="true"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 109.27 109.27 0 0 0-29.08 0 72.37 72.37 0 0 0-3.37-6.83 105.43 105.43 0 0 0-26.23 8.09C2.04 33.84-2.69 58.85.92 83.46a105.73 105.73 0 0 0 32.14 16.14 77.7 77.7 0 0 0 6.89-11.11 72.17 72.17 0 0 1-10.82-5.18c.9-.66 1.8-1.35 2.66-2a75.34 75.34 0 0 0 64.32 0c.87.68 1.76 1.34 2.66 2a72.55 72.55 0 0 1-10.85 5.18 78 78 0 0 0 6.89 11.1 105.35 105.35 0 0 0 32.19-16.14c3.9-27.42-4.14-51.48-19.3-75.38zm-51.06 65.6c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54zm33.85 0c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54z"/></svg>
          </a>

          <div className="kdr-topbar-divider" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile((val) => !val); setShowNotifications(false); }}
              className="flex items-center justify-center min-w-[40px] min-h-[40px] hover:opacity-90 transition"
              title="Perfil"
            >
              <div
                className="w-8 h-8 md:w-8 md:h-8 rounded-full overflow-hidden border-2 transition shadow-sm relative bg-[var(--bg-card)]"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 55%, transparent)", boxShadow: `0 0 10px var(--accent-glow)` }}
              >
                {isImageLoading && <div className="absolute inset-0 kdr-skeleton z-0 rounded-full" />}
                <Image
                  src={displayAvatar}
                  fill
                  sizes="36px"
                  className={`object-cover relative z-10 transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                  alt="avatar"
                  key={displayAvatar}
                  onLoad={() => setIsImageLoading(false)}
                  unoptimized={displayAvatar.startsWith('http') ? false : true}
                />
              </div>
            </button>

            {/* Profile dropdown */}
            {showProfile && (
              <>
                <div
                  className="fixed inset-0 bg-black/60 z-40 md:hidden"
                  onClick={() => setShowProfile(false)}
                />
                <div className="fixed left-2 right-2 top-[calc(env(safe-area-inset-top,0px)+62px)] z-50 w-auto md:absolute md:left-auto md:right-0 md:top-12 md:w-[min(16rem,calc(100vw-1rem))] glass-surface-heavy border border-white/12 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
                  <div className="px-5 md:px-4 py-4 md:py-3 border-b border-[var(--border-subtle)]">
                    <p className="font-bold text-[var(--text-primary)] text-base md:text-sm truncate">
                      {session.user?.name}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs truncate">
                      {session.user?.email}
                    </p>
                  </div>
                  <div className="py-1" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
                    <Link
                      prefetch={true}
                      href={`/profile/${(session.user as any)?.id || ""}`}
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <UserCircle size={17} className="text-[var(--text-accent)]" /> Meu Perfil
                    </Link>
                    <Link
                      prefetch={true}
                      href="/favorites"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <Heart size={17} className="text-[var(--text-accent)]" /> Favoritos
                    </Link>
                    <Link
                      prefetch={true}
                      href="/history"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <Clock3 size={17} className="text-[var(--text-accent)]" /> Historico
                    </Link>
                    <Link
                      prefetch={true}
                      href="/settings"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <Settings2 size={17} className="text-[var(--text-accent)]" /> Configuracoes
                    </Link>
                    {isAdmin && (
                      <Link
                        prefetch={true}
                        href="/admin"
                        onClick={() => setShowProfile(false)}
                        className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                      >
                        <Shield size={17} className="text-[var(--text-accent)]" /> Painel Admin
                      </Link>
                    )}
                    <Link
                      prefetch={true}
                      href="/settings?section=feedback"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <MessageCircle size={17} className="text-[var(--text-accent)]" /> Reportar bug
                    </Link>
                    <div className="border-t border-[var(--border-subtle)] my-0.5" />
                    <button
                      onClick={handleOpenAccountSwitcher}
                      className="w-full flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition min-h-[44px]"
                    >
                      <UserPlus size={17} className="text-[var(--text-accent)]" /> Trocar de conta
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-3 px-5 md:px-4 py-3 md:py-2.5 text-[15px] md:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] transition min-h-[44px]"
                    >
                      <LogOut size={17} /> Sair da Conta
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Account Switcher Modal */}
      {showAccountSwitcher && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
          <div
            className="kdr-modal-backdrop"
            onClick={() => setShowAccountSwitcher(false)}
          />
          <div className="relative z-10 w-full max-w-md kdr-modal-panel rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 animate-slideUpSheet sm:animate-scaleIn">
            <div className="sm:hidden flex justify-center -mt-1 mb-1">
              <span className="kdr-sheet-handle" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-[var(--text-primary)] font-black text-xl sm:text-lg">Trocar de conta</h3>
              <button
                onClick={() => setShowAccountSwitcher(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1"
              >
                <X size={16} />
              </button>
            </div>

            {savedAccounts.length === 0 ? (
              <div className="space-y-3">
                <p className="text-[var(--text-muted)] text-sm">Nenhuma conta salva neste dispositivo.</p>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full text-sm font-bold rounded-xl border border-[var(--border-default)] px-3 py-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition min-h-[44px]"
                >
                  Adicionar outra conta
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                {savedAccounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleQuickSwitchAccount(account)}
                    disabled={switchingEmail !== null}
                    className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[56px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]/50 hover:bg-white/[0.06] text-left transition disabled:opacity-50"
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-card)]">
                      <Image
                        src={
                          account.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(account.name)}&background=333&color=fff`
                        }
                        fill
                        sizes="40px"
                        className="object-cover"
                        alt={account.name}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] sm:text-sm text-[var(--text-primary)] font-semibold truncate">{account.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{account.email}</p>
                    </div>
                    <span className="text-sm sm:text-xs font-bold text-[var(--text-accent)]">
                      {switchingEmail === account.email ? "Entrando..." : "Entrar"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-sm font-bold rounded-xl border border-[var(--border-default)] px-3 py-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition min-h-[44px]"
              >
                Usar outra conta manualmente
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
