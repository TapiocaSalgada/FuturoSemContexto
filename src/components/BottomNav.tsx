"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, Settings, User } from "lucide-react";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  if (!session) return null;

  const navItems = [
    { href: "/", icon: Home, label: "Início" },
    { href: "/favorites", icon: Heart, label: "Lista" },
    { href: "/settings", icon: Settings, label: "Configs" },
    { href: userId ? `/profile/${userId}` : "/profile", icon: User, label: "Perfil" },
  ];


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-white/5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
          <Link
              prefetch={true}
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-1 py-3 px-4 min-w-[60px] transition-all duration-200 ${
                active ? "text-pink-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={22} className={active ? "drop-shadow-[0_0_8px_rgba(255,0,127,0.6)]" : ""} />
              <span className="text-[10px] font-bold tracking-wide">{label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-pink-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
