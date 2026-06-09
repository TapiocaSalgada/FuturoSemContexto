import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import AppShell from "@/components/AppShell";
import AdminApisClient from "@/components/admin/AdminApisClient";
import { isSiteAdmin } from "@/lib/admin-access";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminApisPage() {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) redirect("/");

  return (
    <AppShell>
      <AdminApisClient />
    </AppShell>
  );
}
