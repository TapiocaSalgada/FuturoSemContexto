import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import { createContentAction, deleteContentAction, updateContentStatusAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCatalogoPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const actor = await requireAdminPage();
  const q = String(searchParams.q || "").trim();
  const status = String(searchParams.status || "").trim();
  const where = { ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}), ...(status ? { status } : {}) };
  const [contents, legacy] = await Promise.all([
    prisma.content.findMany({ where, include: { _count: { select: { episodes: true, seasons: true, sources: true } } }, orderBy: { updatedAt: "desc" }, take: 80 }).catch(() => []),
    prisma.anime.findMany({ where: q ? { title: { contains: q, mode: "insensitive" } } : {}, include: { _count: { select: { episodes: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);

  return (
    <AdminShell actor={actor} title="Catálogo" subtitle="CRUD canônico de animes, séries, filmes e especiais.">
      <section className="admin-grid-v17 two">
        <article className="admin-panel-v17">
          <div className="section-heading"><div><h2>Novo conteúdo</h2><p>Importe ou cadastre como rascunho antes de publicar.</p></div></div>
          <form action={createContentAction} className="admin-form-v17">
            <label>Título<input name="title" required /></label>
            <label>Slug<input name="slug" placeholder="opcional" /></label>
            <label>Sinopse<textarea name="synopsis" rows={4} /></label>
            <div className="form-grid"><label>Tipo<select name="kind"><option value="anime">Anime</option><option value="serie">Série</option><option value="movie">Filme</option><option value="special">Especial</option></select></label><label>Status<select name="status"><option value="draft">Rascunho</option><option value="private">Privado</option><option value="public">Publicado</option><option value="archived">Arquivado</option></select></label></div>
            <label>Poster URL<input name="posterUrl" /></label>
            <label>Banner URL<input name="bannerUrl" /></label>
            <div className="form-grid"><label>Gêneros<input name="genres" placeholder="ação, fantasia" /></label><label>Ano<input name="year" type="number" /></label></div>
            <div className="form-grid"><label>Idioma<input name="language" placeholder="Dub | Leg | Ambos" /></label><label>Classificação<input name="ageRating" /></label></div>
            <label className="toggle-row"><input name="isFeatured" type="checkbox" /> Destaque na home</label>
            <button className="primary-action" type="submit">Salvar conteúdo</button>
          </form>
        </article>
        <article className="admin-panel-v17">
          <div className="section-heading"><div><h2>Filtros</h2><p>Busca, status e listagem canônica.</p></div></div>
          <form className="admin-form-v17" action="/admin/catalogo"><label>Buscar<input name="q" defaultValue={q} /></label><label>Status<select name="status" defaultValue={status}><option value="">Todos</option><option value="draft">Rascunho</option><option value="private">Privado</option><option value="public">Publicado</option><option value="archived">Arquivado</option></select></label><button className="secondary-action" type="submit">Filtrar</button></form>
        </article>
      </section>

      <section className="admin-panel-v17">
        <div className="section-heading"><div><h2>Conteúdos canônicos</h2><p>{contents.length} resultados.</p></div></div>
        <div className="admin-table-v17">
          <div className="admin-table-head"><span>Título</span><span>Status</span><span>Estrutura</span><span>Ações</span></div>
          {contents.map((item) => (
            <div className="admin-table-row" key={item.id}>
              <span><strong>{item.title}</strong><small>{item.kind} / {item.slug}</small></span>
              <span className={`status-badge ${item.status}`}>{item.status}</span>
              <span>{item._count.seasons} temporadas / {item._count.episodes} episódios / {item._count.sources} fontes</span>
              <span className="admin-row-actions"><Link href={`/admin/temporadas?contentId=${item.id}`}>Temporadas</Link><Link href={`/admin/episodios?contentId=${item.id}`}>Episódios</Link><form action={updateContentStatusAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value={item.status === "public" ? "private" : "public"} /><button type="submit">{item.status === "public" ? "Ocultar" : "Publicar"}</button></form><form action={deleteContentAction}><input type="hidden" name="id" value={item.id} /><input name="confirm" placeholder="Digite EXCLUIR" aria-label="Confirmar exclusão" /><button type="submit">Excluir</button></form></span>
            </div>
          ))}
          {contents.length === 0 ? <p className="empty-inline">Nenhum conteúdo canônico encontrado.</p> : null}
        </div>
      </section>

      <section className="admin-panel-v17 muted"><div className="section-heading"><div><h2>Legado preservado</h2><p>Dados antigos seguem disponíveis enquanto a ponte gradual existir.</p></div></div><div className="admin-list-v17">{legacy.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{item.visibility} / {item.status}</span><small>{item._count.episodes} episódios</small></div>)}</div></section>
    </AdminShell>
  );
}

