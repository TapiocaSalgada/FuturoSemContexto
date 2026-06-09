import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import { getEnvChecklist } from "@/lib/env-check";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      ok: true,
      ...getEnvChecklist(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
