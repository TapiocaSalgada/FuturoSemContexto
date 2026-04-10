import { NextResponse } from "next/server";

import { DEFAULT_MAINTENANCE_MESSAGE, getMaintenanceState } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getMaintenanceState().catch(() => ({
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: null,
  }));
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
/**
 * Public runtime maintenance-state reader endpoint.
 */
