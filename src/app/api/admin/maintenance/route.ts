import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  getMaintenanceState,
  setMaintenanceState,
} from "@/lib/maintenance";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = await getMaintenanceState().catch(() => ({
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: null,
  }));
  return NextResponse.json(state);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const enabled = Boolean(body?.enabled);
  const message = typeof body?.message === "string" ? body.message : undefined;

  const state = await setMaintenanceState(enabled, message);
  return NextResponse.json({ ok: true, state });
}
/**
 * Admin runtime maintenance mode endpoint.
 */
