"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Compass,
  Grid2X2,
  Home,
  LogOut,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

import ToastContainer from "@/components/Toast";

const desktopNav = [
  { href: "/inicio", label: "Início" },
  { href: "/explorar", label: "Explorar" },
  { href: "/minha-lista", label: "Minha Lista" },
  { href: "/explorar?tab=dublados", label: "Dublados" },
  { href: "/explorar?tab=populares", label: "Populares" },
];

const bottomNav = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/minha-lista", label: "Minha Lista", icon: Grid2X2 },
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/explorar?tab=lancamentos", label: "Lançamentos", icon: Sparkles },
  { href: "/perfil", label: "Conta", icon: User },
];

function cleanPath(href: string) {
  return href.split("?")[0];
}

function isActive(pathname: string, href: string) {
  const path = cleanPath(href);
  if (path === "/inicio") return pathname === "/" || pathname === "/inicio";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toLowerCase() === "admin";
  const isWatch = pathname.startsWith("/assistir") || pathname.startsWith("/watch");

  if (isWatch) return <>{children}</>;

  return (
    <div className="app-shell fsc-app-shell">
      <header className="fsc-topbar">
        <Link className="brand-lockup" href="/inicio" aria-label="Futuro sem Contexto">
          <span className="brand-mark">F</span>
          <span>
            <strong>Futuro sem Contexto</strong>
            <small>anime streaming</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Principal">
          {desktopNav.map((item) => (
            <Link key={item.href} className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-actions">
          <Link className="search-pill" href="/buscar" aria-label="Buscar anime ou perfil">
            <Search aria-hidden size={18} />
            <span>Buscar anime ou perfil</span>
          </Link>
          <Link className="icon-button" href="/configuracoes" aria-label="Notificações e configurações" title="Notificações">
            <Bell aria-hidden size={19} />
          </Link>
          {isAdmin ? (
            <Link className="icon-button admin" href="/admin" aria-label="Admin" title="Admin">
              <Shield aria-hidden size={19} />
            </Link>
          ) : null}
          <Link className="avatar-button" href="/perfil" aria-label="Conta">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" />
            ) : (
              <User aria-hidden size={19} />
            )}
          </Link>
          {session?.user ? (
            <button className="icon-button desktop-only" type="button" onClick={() => signOut({ callbackUrl: "/login" })} title="Sair">
              <LogOut aria-hidden size={19} />
            </button>
          ) : null}
        </div>
      </header>

      <main className="content-shell">{children}</main>

      <nav className="bottom-nav" aria-label="Principal mobile">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} className={isActive(pathname, item.href) ? "bottom-link active" : "bottom-link"} href={item.href}>
              <Icon aria-hidden size={21} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <ToastContainer />
    </div>
  );
}
