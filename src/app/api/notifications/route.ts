import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = Number(new URL(req.url).searchParams.get("limit") || "20");
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, type: { not: "ad" } },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false, type: { not: "ad" } },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

  await prisma.notification.updateMany({
    where: ids.length
      ? { userId: user.id, id: { in: ids } }
      : { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
