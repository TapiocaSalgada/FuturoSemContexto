import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BookOpen, Bug, Database, FileText, Gauge, Import, Layers3, ListVideo, Search, Settings, Shield, Users, ExternalLink, LogOut } from "lucide-react";

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
        <div className="admin-platform-card">
          <span className="status-dot" /> <strong>Status da plataforma</strong><small>Operacional</small>
        </div>
        <Link href="/inicio" className="admin-exit-link" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', color: 'var(--muted)', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', fontWeight: 600 }}>
          <ExternalLink size={16} /> Voltar para o site
        </Link>
      </aside>
      <section className="admin-main-v17">
        <header className="admin-topbar-v17">
          <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
          <form className="admin-search-v17" action="/admin/catalogo"><Search aria-hidden size={18} /><input name="q" placeholder="Buscar animes, episódios, usuários..." /></form>
          <div className="admin-user-v17" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield aria-hidden size={18} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{actor.name}</span>
              <small>{actor.role}</small>
            </div>
            <Link href="/api/auth/signout" title="Sair do Admin" style={{ color: 'var(--danger)', marginLeft: '8px' }}>
              <LogOut size={18} />
            </Link>
          </div>
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


