import AdminShell from "@/components/admin/AdminShell";
import { updateBugAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBugsPage() {
  const actor = await requireAdminPage();
  const bugs = await prisma.bugReport.findMany({ include: { user: { select: { name: true, email: true } }, anime: { select: { title: true } }, content: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 80 });
  return <AdminShell actor={actor} title="Bugs" subtitle="Central de bugs de site, player, anime, episódio e mobile."><section className="admin-panel-v17"><div className="admin-table-v17"><div className="admin-table-head"><span>Bug</span><span>Prioridade</span><span>Status</span><span>Ação</span></div>{bugs.map((bug) => <div className="admin-table-row" key={bug.id}><span><strong>{bug.title}</strong><small>{bug.type} / {bug.user.name || bug.user.email} / {bug.anime?.title || bug.content?.title || bug.pagePath || "Sem vínculo"}</small><small>{bug.description}</small></span><span className={`status-badge ${bug.priority}`}>{bug.priority}</span><span className={`status-badge ${bug.status}`}>{bug.status}</span><span><form action={updateBugAction} className="inline-form-v17"><input type="hidden" name="id" value={bug.id} /><select name="status" defaultValue={bug.status}><option value="open">Aberto</option><option value="investigating">Investigando</option><option value="resolved">Resolvido</option><option value="rejected">Rejeitado</option><option value="closed">Fechado</option></select><select name="priority" defaultValue={bug.priority}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select><input name="adminNotes" placeholder="Nota interna" defaultValue={bug.adminNotes || ""} /><button type="submit">Salvar</button></form></span></div>)}</div>{bugs.length === 0 ? <p className="empty-inline">Nenhum bug enviado.</p> : null}</section></AdminShell>;
}
