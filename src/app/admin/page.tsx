import Link from "next/link";

import AdminShell, { AdminMetricCard } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const actor = await requireAdminPage();
  const [users, legacyTitles, canonicalTitles, legacyEpisodes, canonicalEpisodes, sources, bugs, suggestions, drafts, logs] = await Promise.all([
    prisma.user.count(),
    prisma.anime.count(),
    prisma.content.count(),
    prisma.episode.count(),
    prisma.catalogEpisode.count().catch(() => 0),
    prisma.source.count().catch(() => 0),
    prisma.bugReport.count({ where: { status: { in: ["open", "investigating"] } } }),
    prisma.suggestion.count({ where: { status: { in: ["pending", "open", "reviewing"] } } }),
    prisma.content.count({ where: { status: "draft" } }).catch(() => 0),
    prisma.adminAuditLog.findMany({ include: { admin: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 8 }).catch(() => []),
  ]);

  return (
    <AdminShell actor={actor} title="Painel Admin" subtitle="Visão geral da plataforma e gerenciamento operacional." actions={<><Link className="primary-action" href="/admin/catalogo">+ Novo anime</Link><Link className="secondary-action" href="/admin/sync">Sincronizar</Link></>}>
      <section className="admin-metrics-grid-v17">
        <AdminMetricCard label="Conteúdos" value={legacyTitles + canonicalTitles} hint={`${canonicalTitles} canônicos`} />
        <AdminMetricCard label="Episódios" value={legacyEpisodes + canonicalEpisodes} hint="publicados e rascunhos" tone="cyan" />
        <AdminMetricCard label="Usuários" value={users} hint="contas preservadas" tone="green" />
        <AdminMetricCard label="Bugs abertos" value={bugs} hint="triagem pendente" tone="red" />
        <AdminMetricCard label="Sugestões" value={suggestions} hint="para revisar" />
        <AdminMetricCard label="Sources" value={sources} hint={`${drafts} rascunhos`} tone="cyan" />
      </section>
      <section className="admin-grid-v17 two">
        <article className="admin-panel-v17"><div className="section-heading"><div><h2>Atalhos rápidos</h2><p>Ações reais sem botões decorativos.</p></div></div><div className="admin-quick-grid"><Link href="/admin/catalogo">Adicionar conteúdo</Link><Link href="/admin/temporadas">Criar temporada</Link><Link href="/admin/episodios">Adicionar episódio</Link><Link href="/admin/importar">Importar API</Link><Link href="/admin/bugs">Ver bugs</Link><Link href="/admin/sugestoes">Ver sugestões</Link></div></article>
        <article className="admin-panel-v17"><div className="section-heading"><div><h2>Últimas ações</h2><p>Audit log administrativo.</p></div><Link href="/admin/logs">Ver todos</Link></div><div className="admin-list-v17">{logs.map((log) => <div key={log.id}><strong>{log.action}</strong><span>{log.entityType} {log.entityId || ""}</span><small>{log.admin?.name || log.admin?.email || "Sistema"} / {log.createdAt.toLocaleString("pt-BR")}</small></div>)}{logs.length === 0 ? <p>Nenhum log ainda.</p> : null}</div></article>
      </section>
    </AdminShell>
  );
}
