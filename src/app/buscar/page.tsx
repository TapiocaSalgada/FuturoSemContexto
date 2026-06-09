import AppShell from "@/components/AppShell";
import ExploreClient from "@/components/explore/ExploreClient";
import { listPublicCatalogItems } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function BuscarPage() {
  const initialItems = await listPublicCatalogItems(36);
  return (
    <AppShell>
      <ExploreClient initialItems={initialItems} title="Busca" searchFirst />
    </AppShell>
  );
}
