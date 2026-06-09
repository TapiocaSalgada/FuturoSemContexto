import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BookOpen, Bug, Database, FileText, Gauge, Import, Layers3, ListVideo, Search, Settings, Shield, Users } from "lucide-react";

import type { AdminActor } from "@/lib/admin/permissions";

const navGroups = [
  { label: "Principal", items: [
    { href: "/admin", label: "Dashboard", icon: Gauge },
    { href: "/admin/catalogo", label: "Catálogo", icon: BookOpen },
    { href: "/admin/temporadas", label: "Temporadas", icon: Layers3 },
    { href: "/admin/episodios", label: "Episódios", icon: ListVideo },
  ]},
  { label: "Operação", items: [
    { href: "/admin/importar", label: "Importar APIs", icon: Import },
    { href: "/admin/sync", label: "Sync com diff", icon: Activity },
    { href: "/admin/bugs", label: "Bugs", icon: Bug },
    { href: "/admin/sugestoes", label: "Sugestões", icon: FileText },
  ]},
  { label: "Sistema", items: [
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/sistema", label: "Sistema", icon: Settings },
    { href: "/admin/logs", label: "Logs", icon: Database },
  ]},
];

export default function AdminShell({ actor, title, subtitle, children, actions }: { actor: AdminActor; title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="admin-shell-v17">
      <aside className="admin-sidebar-v17">
        <Link className="admin-brand-v17" href="/admin"><span>F</span><strong>Futuro sem Contexto</strong><small>Painel Admin</small></Link>
        {navGroups.map((group) => (
          <nav key={group.label} className="admin-nav-group" aria-label={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href}><Icon aria-hidden size={17} /> {item.label}</Link>;
            })}
          </nav>
        ))}
        <div className="admin-platform-card"><span className="status-dot" /> <strong>Status da plataforma</strong><small>Operacional</small></div>
      </aside>
      <section className="admin-main-v17">
        <header className="admin-topbar-v17">
          <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
          <form className="admin-search-v17" action="/admin/catalogo"><Search aria-hidden size={18} /><input name="q" placeholder="Buscar animes, episódios, usuários..." /></form>
          <div className="admin-user-v17"><Shield aria-hidden size={18} /><span>{actor.name}</span><small>{actor.role}</small></div>
        </header>
        {actions ? <div className="admin-actions-v17">{actions}</div> : null}
        {children}
      </section>
    </main>
  );
}

export function AdminMetricCard({ label, value, hint, tone = "purple" }: { label: string; value: string | number; hint?: string; tone?: "purple" | "cyan" | "green" | "red" }) {
  return <article className={`admin-metric-v17 ${tone}`}><small>{label}</small><strong>{value}</strong>{hint ? <span>{hint}</span> : null}</article>;
}


