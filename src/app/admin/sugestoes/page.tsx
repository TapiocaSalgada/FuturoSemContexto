import AdminShell from "@/components/admin/AdminShell";
import { updateSuggestionAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSugestoesPage() {
  const actor = await requireAdminPage();
  const suggestions = await prisma.suggestion.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 80 });
  return <AdminShell actor={actor} title="Sugestões" subtitle="Triagem de pedidos de conteúdo e melhoria do site."><section className="admin-panel-v17"><div className="admin-table-v17"><div className="admin-table-head"><span>Sugestão</span><span>Tipo</span><span>Status</span><span>Ação</span></div>{suggestions.map((item) => <div className="admin-table-row" key={item.id}><span><strong>{item.title}</strong><small>{item.user.name || item.user.email}</small><small>{item.description || "Sem detalhes"}</small></span><span>{item.type}</span><span className={`status-badge ${item.status}`}>{item.status}</span><span><form action={updateSuggestionAction} className="inline-form-v17"><input type="hidden" name="id" value={item.id} /><select name="status" defaultValue={item.status}><option value="pending">Pendente</option><option value="reviewed">Em análise</option><option value="accepted">Aceita</option><option value="rejected">Rejeitada</option><option value="closed">Fechada</option></select><input name="adminNotes" placeholder="Nota interna" defaultValue={item.adminNotes || ""} /><button type="submit">Salvar</button></form></span></div>)}</div>{suggestions.length === 0 ? <p className="empty-inline">Nenhuma sugestão enviada.</p> : null}</section></AdminShell>;
}
