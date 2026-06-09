import AdminShell from "@/components/admin/AdminShell";
import AdminImportClient from "@/components/admin/AdminImportClient";
import { requireAdminPage } from "@/lib/admin/permissions";

export const dynamic = "force-dynamic";

export default async function AdminImportarPage() {
  const actor = await requireAdminPage();
  return <AdminShell actor={actor} title="Importar APIs" subtitle="Importação fica separada da edição manual e nunca publica automaticamente."><AdminImportClient /></AdminShell>;
}
