import AppShell from "@/components/AppShell";
import ExploreClient from "@/components/explore/ExploreClient";
import { listPublicCatalogItems } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function ExplorarPage() {
  const initialItems = await listPublicCatalogItems(80);
  return (
    <AppShell>
      <ExploreClient initialItems={initialItems} title="Explorar" />
    </AppShell>
  );
}
