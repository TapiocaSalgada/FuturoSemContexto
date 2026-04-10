import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "source_failure",
  "source_switch",
  "player_fatal",
  "source_manual_switch",
]);

function trimText(value: unknown, max = 240) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function cleanUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("http")) return "";

  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.length > 300 ? parsed.pathname.slice(0, 300) : parsed.pathname;
    return `${parsed.protocol}//${parsed.hostname}${pathname}`;
  } catch {
    return raw.slice(0, 320);
  }
}

function extractHost(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("http")) return "";

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = trimText(body?.event, 64);
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
  }

  const session = await getServerSession(authOptions).catch(() => null);
  const ip =
    req.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean)[0] ||
    "";

  const sourceUrl = cleanUrl(body?.sourceUrl);
  const fallbackUrl = cleanUrl(body?.fallbackUrl);

  const telemetryEvent = {
    scope: "watch-player",
    event,
    createdAt: new Date().toISOString(),
    animeId: trimText(body?.animeId, 80) || null,
    episodeId: trimText(body?.episodeId, 80) || null,
    sourceType: trimText(body?.sourceType, 40) || null,
    sourceLabel: trimText(body?.sourceLabel, 80) || null,
    sourceHost: trimText(body?.sourceHost, 120) || extractHost(sourceUrl) || null,
    sourceUrl: sourceUrl || null,
    fallbackType: trimText(body?.fallbackType, 40) || null,
    fallbackLabel: trimText(body?.fallbackLabel, 80) || null,
    fallbackHost: trimText(body?.fallbackHost, 120) || extractHost(fallbackUrl) || null,
    fallbackUrl: fallbackUrl || null,
    message: trimText(body?.message, 200) || null,
    pagePath: trimText(body?.path, 160) || null,
    pageVisible: trimText(body?.pageVisible, 20) || null,
    network: {
      effectiveType: trimText(body?.network?.effectiveType, 20) || null,
      saveData: Boolean(body?.network?.saveData),
      downlink:
        Number.isFinite(Number(body?.network?.downlink))
          ? Number(body.network.downlink)
          : null,
      rtt: Number.isFinite(Number(body?.network?.rtt)) ? Number(body.network.rtt) : null,
    },
    user: {
      email: session?.user?.email || null,
      role: (session?.user as any)?.role || "guest",
      authenticated: Boolean(session?.user?.email),
      ip: ip || null,
      userAgent: trimText(req.headers.get("user-agent"), 220) || null,
    },
  };

  console.info("[watch-telemetry]", JSON.stringify(telemetryEvent));

  return NextResponse.json({ ok: true });
}
/**
 * Playback telemetry ingestion endpoint.
 */
