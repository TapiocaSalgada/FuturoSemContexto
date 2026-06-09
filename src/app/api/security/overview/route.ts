import { NextResponse } from "next/server";

import { requireSecurityUser } from "@/lib/security-auth";
import prisma from "@/lib/prisma";
import { getRequestIp } from "@/lib/rate-limit";
import { touchAccountSession } from "@/lib/security-events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const result = await requireSecurityUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const userAgent = req.headers.get("user-agent") || "";
  await touchAccountSession({
    userId: result.user.id,
    userAgent,
    ip: getRequestIp(req),
  });

  const [settings, sessions, events] = await Promise.all([
    prisma.userSecuritySettings.upsert({
      where: { userId: result.user.id },
      update: {},
      create: { userId: result.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorConfirmedAt: true,
        sessionInvalidatedAt: true,
      },
    }),
    prisma.accountSession.findMany({
      where: { userId: result.user.id },
      orderBy: { lastSeenAt: "desc" },
      take: 6,
      select: {
        id: true,
        deviceLabel: true,
        ipMasked: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
      },
    }),
    prisma.securityEvent.findMany({
      where: { userId: result.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    account: {
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    },
    twoFactor: settings,
    sessions,
    events,
  });
}
