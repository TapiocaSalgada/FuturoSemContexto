import AdminShell from "@/components/admin/AdminShell";
import { createProviderSyncLogAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const actor = await requireAdminPage();
  const [contents, logs] = await Promise.all([
    prisma.content.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 80 }).catch(() => []),
    prisma.providerSyncLog.findMany({ include: { content: { select: { title: true } }, createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  return (
    <AdminShell actor={actor} title="Sync com diff" subtitle="Preview de sincronização. Nada manual é sobrescrito sem confirmação explícita.">
      <section className="admin-grid-v17 two"><article className="admin-panel-v17"><div className="section-heading"><div><h2>Novo preview</h2><p>Registre o diff antes de aplicar qualquer mudança.</p></div></div><form action={createProviderSyncLogAction} className="admin-form-v17"><label>Provider<select name="provider"><option value="kappa">Kappa</option><option value="sugoi">Sugoi</option><option value="anfire">AnFire</option><option value="animefenix">AnimeFenix</option><option value="playanimes">PlayAnimes</option><option value="animesbrasil">AnimesBrasil</option><option value="zenshin">Zenshin</option><option value="embedmovies">EmbedMovies</option><option value="manual">Manual</option></select></label><label>Conteúdo<select name="contentId"><option value="">Sem vínculo</option>{contents.map((content) => <option key={content.id} value={content.id}>{content.title}</option>)}</select></label><label>Resumo<textarea name="summary" rows={3} placeholder="Novo episódio, título alterado, fonte atualizada..." /></label><div className="form-grid"><label>Novos<input name="newEpisodes" type="number" defaultValue="0" /></label><label>Alterados<input name="changedEpisodes" type="number" defaultValue="0" /></label><label>Removidos na API<input name="removedInApi" type="number" defaultValue="0" /></label></div><input type="hidden" name="status" value="preview" /><button className="primary-action" type="submit">Gerar preview</button></form></article><article className="admin-panel-v17"><h2>Regras do sync</h2><div className="settings-list"><div className="settings-row"><span><strong>Nunca apagar manual</strong><small>Episódio manual exige confirmação fora do preview.</small></span></div><div className="settings-row"><span><strong>Nunca trocar source manual</strong><small>Fontes manuais ficam protegidas.</small></span></div><div className="settings-row"><span><strong>Publicação manual</strong><small>Importado entra como draft.</small></span></div></div></article></section>
      <section className="admin-panel-v17"><div className="section-heading"><div><h2>Logs de sync</h2><p>{logs.length} previews recentes.</p></div></div><div className="admin-list-v17">{logs.map((log) => <div key={log.id}><strong>{log.provider} / {log.status}</strong><span>{log.content?.title || "Sem conteúdo"}</span><small>{log.createdBy?.name || "Admin"} / {log.createdAt.toLocaleString("pt-BR")}</small></div>)}</div></section>
    </AdminShell>
  );
}
