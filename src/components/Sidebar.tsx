"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Home, Search, Star, Settings, Heart, Clock, Disc3, ShieldCheck, X, Menu, MessageSquare, LogOut
} from "lucide-react";
import { signOut } from "next-auth/react";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const links = [
    { name: "Início", href: "/", icon: Home },
    { name: "Explorar", href: "/explore", icon: Search },
    { name: "Minha Lista", href: "/favorites", icon: Star },
    { name: "Histórico", href: "/history", icon: Clock },
    // @ts-expect-error nextauth role typing
    ...(session?.user?.role === "admin" ? [{ name: "Painel Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <Link prefetch={true} href="/" className="flex items-center gap-3 mb-8 overflow-hidden group px-2" onClick={() => setMobileOpen(false)}>
        <Image
          src="/logo.png"
          alt="Futuro sem Contexto"
          width={36}
          height={36}
          className="rounded-xl object-cover shrink-0 group-hover:scale-110 transition duration-300 shadow-[0_0_12px_rgba(255,0,127,0.5)]"
        />
        <div className={`leading-none ${mobile ? "block" : "hidden lg:block"}`}>
          <span className="text-pink-500 font-black text-base tracking-widest uppercase drop-shadow-[0_0_8px_rgba(255,0,127,0.5)]">Futuro</span><br />
          <span className="text-white font-black text-xs tracking-widest uppercase opacity-80">Sem Contexto</span>
        </div>
      </Link>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1 flex-1">
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
                  ? "bg-pink-600/90 text-white shadow-[0_0_20px_rgba(255,0,127,0.3)] font-bold"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800/80"
              }`}
              title={link.name}
            >
              <Icon size={20} className="shrink-0" />
              <span className={`font-semibold text-sm truncate ${mobile ? "block" : "hidden lg:block"}`}>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-1">
        <a
          href="https://discord.gg/futurosemcontexto"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] text-zinc-400 hover:text-[#5865F2] hover:bg-[#5865F2]/10`}
          title="Entrar no Discord"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 127.14 96.36" className="shrink-0"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 109.27 109.27 0 0 0-29.08 0 72.37 72.37 0 0 0-3.37-6.83 105.43 105.43 0 0 0-26.23 8.09C2.04 33.84-2.69 58.85.92 83.46a105.73 105.73 0 0 0 32.14 16.14 77.7 77.7 0 0 0 6.89-11.11 72.17 72.17 0 0 1-10.82-5.18c.9-.66 1.8-1.35 2.66-2a75.34 75.34 0 0 0 64.32 0c.87.68 1.76 1.34 2.66 2a72.55 72.55 0 0 1-10.85 5.18 78 78 0 0 0 6.89 11.1 105.35 105.35 0 0 0 32.19-16.14c3.9-27.42-4.14-51.48-19.3-75.38zm-51.06 65.6c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54zm33.85 0c-6.17 0-11.3-5.63-11.3-12.54 0-6.9 4.96-12.54 11.3-12.54 6.34 0 11.45 5.68 11.3 12.54 0 6.91-4.96 12.54-11.3 12.54z"/></svg>
          <span className={`font-semibold text-sm ${mobile ? "block" : "hidden lg:block"} `}>Discord do Grupo</span>
        </a>
        <Link
          prefetch={true}
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
            pathname === "/settings"
              ? "bg-pink-600/90 text-white shadow-[0_0_20px_rgba(255,0,127,0.3)]"
              : "text-zinc-500 hover:text-white hover:bg-zinc-800/80"
          }`}
          title="Configurações"
        >
          <Settings size={20} className="shrink-0" />
          <span className={`font-semibold text-sm ${mobile ? "block" : "hidden lg:block"}`}>Configurações</span>
        </Link>
        {mobile && (
          <button
            onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/login" }); }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 w-full text-left`}
            title="Trocar de conta / Sair"
          >
            <LogOut size={20} className="shrink-0" />
            <span className={`font-semibold text-sm block`}>Sair da Conta</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        className="md:hidden fixed top-3 left-4 z-50 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition bg-[#0d0d0d]/80 rounded-xl border border-white/10"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-[#0d0d0d]/98 backdrop-blur-xl border-r border-pink-500/10 flex flex-col py-6 px-4 z-50 transition-transform duration-300 shadow-[10px_0_40px_rgba(0,0,0,0.8)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 24px)", paddingBottom: "env(safe-area-inset-bottom, 24px)" }}
      >
        <button
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <NavContent mobile />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-16 lg:w-60 h-screen bg-[#0d0d0d]/90 backdrop-blur-xl border-r border-pink-500/10 flex-col py-6 px-3 shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-40 fixed top-0 left-0">
        <NavContent />
      </aside>
    </>
  );
}
