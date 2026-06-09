import AdminShell from "@/components/admin/AdminShell";
import { toggleUserBanAction, updateUserRoleAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const actor = await requireAdminPage();
  const users = await prisma.user.findMany({ include: { _count: { select: { histories: true, favorites: true, accountSessions: true } } }, orderBy: { lastActiveAt: "desc" }, take: 100 });
  return <AdminShell actor={actor} title="Usuários" subtitle="Permissões, banimentos e sessões sem expor dados sensíveis."><section className="admin-panel-v17"><div className="admin-table-v17"><div className="admin-table-head"><span>Usuário</span><span>Role</span><span>Status</span><span>Ações</span></div>{users.map((user) => <div className="admin-table-row" key={user.id}><span><strong>{user.name}</strong><small>{user.email} {user.username ? `/ @${user.username}` : ""}</small><small>{user._count.histories} histórico / {user._count.favorites} favoritos / {user._count.accountSessions} sessões</small></span><span>{user.role}</span><span className={`status-badge ${user.banned ? "critical" : "public"}`}>{user.banned ? "Banido" : "Ativo"}</span><span><form action={updateUserRoleAction} className="inline-form-v17"><input type="hidden" name="id" value={user.id} /><select name="role" defaultValue={user.role}><option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option><option value="owner">owner</option></select><button type="submit">Role</button></form><form action={toggleUserBanAction} className="inline-form-v17"><input type="hidden" name="id" value={user.id} /><input name="banReason" placeholder="Motivo" /><button type="submit">{user.banned ? "Desbanir" : "Banir"}</button></form></span></div>)}</div></section></AdminShell>;
}
