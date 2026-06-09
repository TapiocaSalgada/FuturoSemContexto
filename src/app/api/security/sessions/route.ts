import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/rate-limit";
import { requireSecurityUser } from "@/lib/security-auth";
import { touchAccountSession } from "@/lib/security-events";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const result = await requireSecurityUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await touchAccountSession({
    userId: result.user.id,
    userAgent: req.headers.get("user-agent") || "",
    ip: getRequestIp(req),
  });

  const sessions = await prisma.accountSession.findMany({
    where: { userId: result.user.id },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
    select: {
      id: true,
      deviceLabel: true,
      ipMasked: true,
      createdAt: true,
      lastSeenAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json({ sessions });
}
