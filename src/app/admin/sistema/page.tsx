import AdminShell from "@/components/admin/AdminShell";
import { createAnnouncementAction, updateMaintenanceAction, upsertSystemSettingAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/permissions";
import { getMaintenanceState } from "@/lib/maintenance";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const flags = [
  ["show_suggestions", "Mostrar sugestões"],
  ["show_bugs", "Mostrar bugs"],
  ["show_profiles", "Mostrar perfis"],
  ["show_watchlist", "Mostrar minha lista"],
  ["show_continue_watching", "Continuar assistindo"],
];

export default async function AdminSistemaPage() {
  const actor = await requireAdminPage();
  const [maintenance, settings, announcements, bugs, sources] = await Promise.all([
    getMaintenanceState(),
    prisma.systemSetting.findMany().catch(() => []),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.bugReport.count({ where: { status: { in: ["open", "investigating"] } } }),
    prisma.source.count({ where: { isActive: true } }).catch(() => 0),
  ]);
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  return (
    <AdminShell actor={actor} title="Sistema" subtitle="Manutenção, avisos globais, flags e saúde operacional.">
      <section className="admin-metrics-grid-v17"><article className="admin-metric-v17 green"><small>Supabase/API</small><strong>Online</strong><span>checagem via build</span></article><article className="admin-metric-v17 cyan"><small>Player</small><strong>{sources}</strong><span>fontes ativas</span></article><article className="admin-metric-v17 red"><small>Erros recentes</small><strong>{bugs}</strong><span>bugs abertos</span></article></section>
      <section className="admin-grid-v17 two"><article className="admin-panel-v17"><div className="section-heading"><div><h2>Modo manutenção</h2><p>Admin continua acessando.</p></div></div><form action={updateMaintenanceAction} className="admin-form-v17"><label className="toggle-row"><input name="enabled" type="checkbox" defaultChecked={maintenance.enabled} /> Ativar manutenção</label><label>Mensagem<textarea name="message" rows={3} defaultValue={maintenance.message} /></label><button className="primary-action" type="submit">Salvar manutenção</button></form></article><article className="admin-panel-v17"><div className="section-heading"><div><h2>Aviso global</h2><p>Cria anúncio interno para usuários.</p></div></div><form action={createAnnouncementAction} className="admin-form-v17"><label>Título<input name="title" required /></label><label>Mensagem<textarea name="content" rows={3} required /></label><button className="primary-action" type="submit">Criar aviso</button></form></article></section>
      <section className="admin-panel-v17"><div className="section-heading"><div><h2>Feature flags</h2><p>Flags simples sem prometer recursos inexistentes.</p></div></div><div className="settings-list">{flags.map(([key, label]) => { const enabled = Boolean((byKey.get(key)?.value as any)?.enabled); return <form action={upsertSystemSettingAction} className="settings-row" key={key}><input type="hidden" name="key" value={key} /><span><strong>{label}</strong><small>{key}</small></span><label className="toggle-row"><input name="enabled" type="checkbox" defaultChecked={enabled} /> Ativo</label><button type="submit">Salvar</button></form>; })}</div></section>
      <section className="admin-panel-v17"><div className="section-heading"><div><h2>Avisos recentes</h2></div></div><div className="admin-list-v17">{announcements.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{item.content}</span><small>{item.createdAt.toLocaleString("pt-BR")}</small></div>)}</div></section>
    </AdminShell>
  );
}
