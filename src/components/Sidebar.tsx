"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Home, Search, Star, Settings, Heart, Clock, Disc3, ShieldCheck, X, Menu
} from "lucide-react";

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
    { name: "Discord", href: "/discord", icon: Disc3 },
    // @ts-expect-error nextauth role typing
    ...(session?.user?.role === "admin" ? [{ name: "Painel Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8 overflow-hidden group px-2" onClick={() => setMobileOpen(false)}>
        <Heart className="text-pink-500 w-9 h-9 fill-pink-500 drop-shadow-[0_0_12px_rgba(255,0,127,0.8)] shrink-0 group-hover:scale-110 transition duration-300" />
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
      <div className="mt-auto pt-4 border-t border-white/5">
        <Link
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
