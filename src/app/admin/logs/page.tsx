import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const actor = await requireAdminPage();
  const logs = await prisma.adminAuditLog.findMany({ include: { admin: { select: { name: true, email: true } }, content: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 120 }).catch(() => []);
  return <AdminShell actor={actor} title="Logs e auditoria" subtitle="Ações administrativas relevantes com antes/depois quando disponível."><section className="admin-panel-v17"><div className="admin-table-v17"><div className="admin-table-head"><span>Ação</span><span>Entidade</span><span>Admin</span><span>Data</span></div>{logs.map((log) => <div className="admin-table-row" key={log.id}><span><strong>{log.action}</strong><small>{log.content?.title || ""}</small></span><span>{log.entityType} {log.entityId || ""}</span><span>{log.admin?.name || log.admin?.email || "Sistema"}</span><span>{log.createdAt.toLocaleString("pt-BR")}</span></div>)}</div>{logs.length === 0 ? <p className="empty-inline">Nenhum log registrado.</p> : null}</section></AdminShell>;
}
