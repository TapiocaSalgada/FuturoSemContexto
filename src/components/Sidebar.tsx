"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Star, Settings, Heart, MessageSquare, Clock, DiscIcon, Info } from "lucide-react";
import { useSession } from "next-auth/react";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const links = [
    { name: "Início", href: "/", icon: Home },
    { name: "Explorar", href: "/explore", icon: Search },
    { name: "Minha Lista", href: "/favorites", icon: Star },
    { name: "Histórico", href: "/history", icon: Clock },
    // @ts-expect-error nextauth role typing
    ...(session?.user?.role === "admin" ? [{ name: "Painel Admin", href: "/admin", icon: Settings }] : []),
    { name: "Discord", href: "/discord", icon: DiscIcon },
    { name: "Sobre", href: "/about", icon: Info },
  ];

  return (
    <aside className="w-16 lg:w-60 h-screen bg-[#0d0d0d] border-r border-pink-500/10 flex flex-col justify-between py-6 px-3 shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-40 fixed top-0 left-0">
      <div>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-8 overflow-hidden lg:px-2 group">
          <Heart className="text-pink-500 w-8 h-8 fill-pink-500 drop-shadow-[0_0_8px_#ff007f] shrink-0 group-hover:scale-110 transition" />
          <div className="hidden lg:block leading-none">
            <span className="text-pink-500 font-black text-sm tracking-widest uppercase">Futuro</span><br />
            <span className="text-white font-black text-xs tracking-widest uppercase">Sem Contexto</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  active
                    ? "bg-pink-600 text-white shadow-[0_0_15px_rgba(255,0,127,0.3)]"
                    : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                }`}
                title={link.name}
              >
                <Icon size={20} className="shrink-0" />
                <span className="hidden lg:block font-semibold text-sm truncate">{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Settings */}
      <div>
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            pathname === "/settings"
              ? "bg-pink-600 text-white"
              : "text-zinc-500 hover:text-white hover:bg-zinc-800"
          }`}
          title="Configurações"
        >
          <Settings size={20} className="shrink-0" />
          <span className="hidden lg:block font-semibold text-sm">Configurações</span>
        </Link>
      </div>
    </aside>
  );
}
