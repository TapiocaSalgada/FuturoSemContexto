import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import { createCanonicalSeasonAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTemporadasPage({ searchParams }: { searchParams: { contentId?: string } }) {
  const actor = await requireAdminPage();
  const contentId = String(searchParams.contentId || "");
  const [contents, seasons] = await Promise.all([
    prisma.content.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, slug: true, status: true }, take: 120 }).catch(() => []),
    contentId ? prisma.season.findMany({ where: { contentId }, include: { _count: { select: { episodes: true } }, content: true }, orderBy: { seasonNumber: "asc" } }).catch(() => []) : Promise.resolve([]),
  ]);
  const selected = contents.find((item) => item.id === contentId);

  return (
    <AdminShell actor={actor} title="Temporadas" subtitle="Criação, ordenação e publicação de temporadas reais.">
      <section className="admin-grid-v17 two">
        <article className="admin-panel-v17"><div className="section-heading"><div><h2>Selecionar conteúdo</h2><p>Escolha um título canônico.</p></div></div><div className="admin-list-v17">{contents.map((item) => <Link key={item.id} className={item.id === contentId ? "active" : ""} href={`/admin/temporadas?contentId=${item.id}`}><strong>{item.title}</strong><span>{item.status}</span></Link>)}</div></article>
        <article className="admin-panel-v17"><div className="section-heading"><div><h2>Nova temporada</h2><p>{selected ? selected.title : "Selecione um conteúdo primeiro."}</p></div></div><form action={createCanonicalSeasonAction} className="admin-form-v17"><input type="hidden" name="contentId" value={contentId} /><label>Número<input name="seasonNumber" type="number" min="1" required disabled={!contentId} /></label><label>Título<input name="title" disabled={!contentId} /></label><label>Sinopse<textarea name="synopsis" rows={3} disabled={!contentId} /></label><label>Capa<input name="posterUrl" disabled={!contentId} /></label><label>Status<select name="status" disabled={!contentId}><option value="draft">Rascunho</option><option value="public">Publicado</option><option value="private">Privado</option></select></label><button className="primary-action" disabled={!contentId} type="submit">Salvar temporada</button></form></article>
      </section>
      <section className="admin-panel-v17"><div className="section-heading"><div><h2>Temporadas {selected ? `de ${selected.title}` : ""}</h2><p>{seasons.length} temporadas encontradas.</p></div></div><div className="admin-table-v17"><div className="admin-table-head"><span>Temporada</span><span>Status</span><span>Episódios</span><span>Ações</span></div>{seasons.map((season) => <div className="admin-table-row" key={season.id}><span><strong>T{season.seasonNumber} - {season.title || "Sem título"}</strong><small>{season.synopsis || "Sem sinopse"}</small></span><span className={`status-badge ${season.status}`}>{season.status}</span><span>{season._count.episodes}</span><span className="admin-row-actions"><Link href={`/admin/episodios?contentId=${season.contentId}&seasonId=${season.id}`}>Abrir episódios</Link></span></div>)}{contentId && seasons.length === 0 ? <p className="empty-inline">Nenhuma temporada criada.</p> : null}</div></section>
    </AdminShell>
  );
}
