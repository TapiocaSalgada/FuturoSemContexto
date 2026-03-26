import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.$transaction([
    prisma.user.update({
      where: { email: session.user.email },
      data: { lastReadAnnouncements: new Date() },
    }),
    prisma.notification.updateMany({
      where: { userId: user.id, type: "announcement", isRead: false },
      data: { isRead: true },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
