"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Home, Star, Settings, Clock, ShieldCheck, X, Menu, MessageSquare, LogOut, BookOpen, LifeBuoy, Sparkles
} from "lucide-react";
import { signOut } from "next-auth/react";
import SuggestionButton from "@/components/SuggestionButton";
import { upsertSavedAccount } from "@/lib/saved-accounts";

type NavigationState = {
  canAccessAnimeTab?: boolean;
  canAccessMangaTab?: boolean;
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigation, setNavigation] = useState<NavigationState>({});

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Save current account to LocalStorage for "Multi-Account Switcher"
  useEffect(() => {
    if (session?.user?.email) {
      const userAvatar =
        (session.user as any).avatarUrl ||
        session.user.image ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.name || "U")}&background=7f1d1d&color=fff`;
      const handoffHash = (session.user as any).handoffHash || undefined;

      upsertSavedAccount(
        {
          email: session.user.email,
          name: session.user.name || session.user.email,
          avatar: userAvatar,
          handoffHash,
        },
        8,
      );
    }
  }, [session]);

  useEffect(() => {
    let alive = true;
    fetch("/api/system/navigation", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setNavigation({
          canAccessAnimeTab: Boolean(data.canAccessAnimeTab),
          canAccessMangaTab: Boolean(data.canAccessMangaTab),
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const canAccessAnimeTab = navigation.canAccessAnimeTab ?? true;
  const canAccessMangaTab = navigation.canAccessMangaTab ?? false;

  const links = [
    ...(canAccessAnimeTab ? [{ name: "Animes", href: "/", icon: Home }] : []),
    ...(canAccessMangaTab ? [{ name: "Mangás", href: "/mangas", icon: BookOpen }] : []),
    { name: "Social", href: "/social", icon: MessageSquare },
    { name: "Minha Lista", href: "/favorites", icon: Star },
    { name: "Histórico", href: "/history", icon: Clock },
  ];

  // @ts-expect-error nextauth role typing
  const adminLink = session?.user?.role === "admin"
    ? { name: "Painel Admin", href: "/admin", icon: ShieldCheck }
    : null;

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <Link prefetch={true} href="/" className="flex items-center gap-3 mb-8 overflow-hidden group px-2" onClick={() => setMobileOpen(false)}>
        <Image
          src="/logo.png"
          alt="Futuro sem Contexto"
          width={36}
          height={36}
          className="rounded-xl object-cover shrink-0 group-hover:scale-110 transition duration-300"
          style={{ boxShadow: `0 0 12px var(--accent-glow)` }}
        />
        <div className={`leading-none ${mobile ? "block" : "hidden lg:block"}`}>
          <span className="font-black text-base tracking-widest uppercase text-[var(--text-accent)]" style={{ filter: `drop-shadow(0 0 8px var(--accent-glow))` }}>Futuro</span><br />
          <span className="text-white font-black text-xs tracking-widest uppercase opacity-70">Sem Contexto</span>
        </div>
      </Link>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1 flex-1">
        {mobile && (
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black">Navegação</p>
        )}
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              prefetch={true}
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
                active
                  ? "text-white font-bold"
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06]"
              }`}
              style={active ? {
                background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 80%, black), color-mix(in srgb, var(--accent) 40%, var(--bg-card)))`,
                boxShadow: `0 4px 20px var(--accent-glow)`,
              } : undefined}
              title={link.name}
            >
              <Icon size={20} className="shrink-0" />
              <span className={`font-semibold text-sm truncate ${mobile ? "block" : "hidden lg:block"}`}>{link.name}</span>
            </Link>
          );
        })}

        <SuggestionButton
          variant="sidebar"
          mobileSidebar={mobile}
        />

        {adminLink && (() => {
          const AdminIcon = adminLink.icon;
          const active = pathname === adminLink.href;
          return (
            <Link
              prefetch={true}
              href={adminLink.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
                active
                  ? "text-white font-bold"
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06]"
              }`}
              style={active ? {
                background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 80%, black), color-mix(in srgb, var(--accent) 40%, var(--bg-card)))`,
                boxShadow: `0 4px 20px var(--accent-glow)`,
              } : undefined}
              title={adminLink.name}
            >
              <AdminIcon size={20} className="shrink-0" />
              <span className={`font-semibold text-sm truncate ${mobile ? "block" : "hidden lg:block"}`}>
                {adminLink.name}
              </span>
            </Link>
          );
        })()}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-4 border-t border-[var(--border-subtle)] space-y-1">
        {mobile && (
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black">Conta e suporte</p>
        )}
        <div className="px-3 py-2">
          <Link
            prefetch={true}
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center h-8 px-3.5 rounded-full text-[11px] font-black border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text-accent)] hover:bg-[var(--accent-dim)] transition"
          >
            <Sparkles size={12} className="mr-1.5" /> Assinatura
          </Link>
        </div>
        <a
          href="https://discord.gg/z2DRmZSHNy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] text-[var(--text-muted)] hover:text-[#5865F2] hover:bg-[#5865F2]/10"
          title="Entrar no Discord"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 127.14 96.36" className="shrink-0"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 109.27 109.27 0 0 0-29.08 0 72.37 72.37 0 0 0-3.37-6.83 105.43 105.43 0 0 0-26.23 8.09C2.04 33.84-2.69 58.85.92 83.46a105.73 105.73 0 0 0 32.14 16.14 77.7 77.7 0 0 0 6.89-11.11 72.17 72.17 0 0 1-10.82-5.18c.9-.66 1.8-1.35 2.66-2a75.34 75.34 0 0 0 64.32 0c.87.68 1.76 1.34 2.66 2a72.55 72.55 0 0 1-10.85 5.18 78 78 0 0 0 6.89 11.1 105.35 105.35 0 0 0 32.19-16.14c3.9-27.42-4.14-51.48-19.3-75.38zm-51.06 65.6c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54zm33.85 0c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54z"/></svg>
          <span className={`font-semibold text-sm ${mobile ? "block" : "hidden lg:block"} `}>Discord</span>
        </a>
        <Link
          prefetch={true}
          href="/about"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
            pathname === "/about"
              ? "text-white"
              : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06]"
          }`}
          style={pathname === "/about" ? {
            background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 80%, black), color-mix(in srgb, var(--accent) 40%, var(--bg-card)))`,
            boxShadow: `0 4px 20px var(--accent-glow)`,
          } : undefined}
          title="Ajuda"
        >
          <LifeBuoy size={20} className="shrink-0" />
          <span className={`font-semibold text-sm ${mobile ? "block" : "hidden lg:block"}`}>Ajuda</span>
        </Link>
        <Link
          prefetch={true}
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
            pathname === "/settings"
              ? "text-white"
              : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06]"
          }`}
          style={pathname === "/settings" ? {
            background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 80%, black), color-mix(in srgb, var(--accent) 40%, var(--bg-card)))`,
            boxShadow: `0 4px 20px var(--accent-glow)`,
          } : undefined}
          title="Configurações"
        >
          <Settings size={20} className="shrink-0" />
          <span className={`font-semibold text-sm ${mobile ? "block" : "hidden lg:block"}`}>Configurações</span>
        </Link>
        {mobile && (
          <button
            onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/login" }); }}
            className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 w-full text-left"
            title="Trocar de conta / Sair"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="font-semibold text-sm block">Sair da Conta</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition rounded-full border border-white/15 bg-black/65 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        <Menu size={19} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-[18.5rem] glass-surface-heavy flex flex-col py-6 px-4 z-50 transition-transform duration-300 shadow-[10px_0_40px_rgba(0,0,0,0.8)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 24px)", paddingBottom: "env(safe-area-inset-bottom, 24px)" }}
      >
        <button
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition p-1"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <NavContent mobile />
      </aside>
    </>
  );
}
