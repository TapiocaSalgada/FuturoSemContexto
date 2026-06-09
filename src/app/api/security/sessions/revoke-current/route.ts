import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/rate-limit";
import { requireSecurityUser } from "@/lib/security-auth";
import { recordSecurityEvent, sessionHash } from "@/lib/security-events";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const result = await requireSecurityUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const hash = sessionHash(result.user.id, req.headers.get("user-agent") || "", getRequestIp(req));
  await prisma.accountSession.updateMany({
    where: { userId: result.user.id, sessionIdHash: hash },
    data: { revokedAt: new Date() },
  });
  await recordSecurityEvent(result.user.id, "session_revoked_current");

  return NextResponse.json({
    ok: true,
    message: "Sessão marcada como encerrada. O navegador será desconectado.",
  });
}
