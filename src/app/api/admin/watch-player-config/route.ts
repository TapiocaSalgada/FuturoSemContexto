import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  WATCH_PLAYER_SOURCE_KEYS,
  type WatchPlayerConfig,
  type WatchPlayerSourceKey,
} from "@/lib/watch-player-config";
import {
  getWatchPlayerConfigState,
  setWatchPlayerConfigState,
} from "@/lib/watch-player-config-store";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = await getWatchPlayerConfigState();
  return NextResponse.json(state);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const nextState: Partial<WatchPlayerConfig> = {};

  const autoplaySeconds = Number(body?.autoplaySeconds);
  if (Number.isFinite(autoplaySeconds)) {
    nextState.autoplaySeconds = autoplaySeconds;
  }

  const nextPromptDefaultWindowSeconds = Number(body?.nextPromptDefaultWindowSeconds);
  if (Number.isFinite(nextPromptDefaultWindowSeconds)) {
    nextState.nextPromptDefaultWindowSeconds = nextPromptDefaultWindowSeconds;
  }

  const rawSourceWindows = body?.nextPromptWindowBySource;
  if (rawSourceWindows && typeof rawSourceWindows === "object") {
    const sourcePatch: Partial<Record<WatchPlayerSourceKey, number>> = {};
    for (const sourceKey of WATCH_PLAYER_SOURCE_KEYS) {
      const value = Number(rawSourceWindows[sourceKey]);
      if (Number.isFinite(value)) {
        sourcePatch[sourceKey] = value;
      }
    }

    if (Object.keys(sourcePatch).length > 0) {
      nextState.nextPromptWindowBySource = sourcePatch as Record<WatchPlayerSourceKey, number>;
    }
  }

  const state = await setWatchPlayerConfigState(nextState);
  return NextResponse.json({ ok: true, state });
}
/**
 * Admin endpoint for runtime watch-player timing configuration.
 */
