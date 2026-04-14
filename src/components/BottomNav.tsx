"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type NavigationState = {
  canAccessAnimeTab?: boolean;
};

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [navigation, setNavigation] = useState<NavigationState>({});

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

  if (!session) return null;

  const canAccessAnimeTab = navigation.canAccessAnimeTab ?? true;

  const navItems = [
    ...(canAccessAnimeTab ? [{ href: "/", icon: Home, label: "Início" }] : []),
    { href: "/explore", icon: Search, label: "Explorar" },
    { href: "/favorites", icon: Heart, label: "Favoritos" },
    { href: "/settings", icon: Menu, label: "Configurações" },
  ];

  return (
    <nav
      className="bottom-nav-shell fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-3 mb-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-0)]/95 shadow-[0_18px_45px_rgba(0,0,0,0.58)] overflow-hidden">
        <div className="grid grid-cols-4 gap-1 p-1.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                prefetch={true}
                key={href}
                href={href}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-[var(--accent-soft)] text-white"
                    : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
                }`}
              >
                {active ? (
                  <span
                    className="absolute top-1.5 h-1 w-7 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #8f67ff 0%, #5536d9 100%)",
                      boxShadow: "0 0 14px rgba(109,74,255,0.55)",
                    }}
                  />
                ) : null}

                <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
                <span className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

