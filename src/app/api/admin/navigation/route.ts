import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getNavigationState, setNavigationState } from "@/lib/navigation";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = await getNavigationState().catch(() => ({
    animeTabEnabled: true,
    mangaTabEnabled: false,
    updatedAt: null,
  }));
  return NextResponse.json(state);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const state = await setNavigationState({
    animeTabEnabled: Boolean(body?.animeTabEnabled),
    mangaTabEnabled: Boolean(body?.mangaTabEnabled),
  });

  return NextResponse.json({ ok: true, state });
}
