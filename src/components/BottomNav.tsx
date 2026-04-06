"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, MessageSquare, BookOpen } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type NavigationState = {
  canAccessAnimeTab?: boolean;
  canAccessMangaTab?: boolean;
};

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const [navigation, setNavigation] = useState<NavigationState>({});

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

  if (!session) return null;

  const canAccessAnimeTab = navigation.canAccessAnimeTab ?? true;
  const canAccessMangaTab = navigation.canAccessMangaTab ?? false;

  const navItems = [
    ...(canAccessAnimeTab ? [{ href: "/", icon: Home, label: "Animes" }] : []),
    ...(canAccessMangaTab ? [{ href: "/mangas", icon: BookOpen, label: "Mangás" }] : []),
    { href: "/social", icon: MessageSquare, label: "Social" },
    { href: userId ? `/profile/${userId}` : "/profile", icon: User, label: "Perfil" },
  ];

  return (
    <nav
      className="bottom-nav-shell fixed bottom-2.5 left-3 right-3 z-40 md:hidden transition-all duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="glass-surface-heavy rounded-2xl overflow-hidden">
        {/* Top gradient line */}
        <div
          className="h-[1px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--accent) 55%, transparent) 50%, transparent 95%)`,
          }}
        />

        <div className="flex items-stretch justify-around px-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                prefetch={true}
                key={href}
                href={href}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[54px] rounded-xl transition-all duration-200 active:scale-[0.98] ${
                  active ? "text-white" : "text-[var(--text-muted)] active:text-[var(--text-secondary)]"
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <span
                    className="absolute top-0 w-8 h-[2px] rounded-full"
                    style={{
                      backgroundColor: "var(--accent)",
                      boxShadow: `0 2px 12px var(--accent-glow)`,
                    }}
                  />
                )}

                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={`transition-all duration-200 ${active ? "" : ""}`}
                  style={active ? { color: "var(--accent)", filter: `drop-shadow(0 0 8px var(--accent-glow))` } : undefined}
                />
                <span
                  className={`text-[10px] leading-none transition-all duration-200 ${
                    active ? "font-bold" : "font-medium"
                  }`}
                  style={active ? { color: "var(--accent)" } : undefined}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
