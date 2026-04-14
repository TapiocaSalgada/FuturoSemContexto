import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotificationsForUsers } from "@/lib/notifications";
import { isSystemAnnouncementTitle } from "@/lib/maintenance";

export async function GET() {
  const announcements = await prisma.announcement.findMany({
    where: {
      NOT: {
        title: {
          startsWith: "__system:",
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json(announcements);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { title, content } = await req.json();
  const announcement = await prisma.announcement.create({ data: { title, content } });
  const users = await prisma.user.findMany({
    select: {
      id: true,
      settings: { select: { notifyAnnouncements: true } },
    },
  });
  await createNotificationsForUsers(
    users
      .filter((user) => user.settings?.notifyAnnouncements === true)
      .map((user) => user.id),
    {
      actorId: null,
      type: "announcement",
      title,
      body: content,
      link: "/",
    },
  );
  return NextResponse.json(announcement);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { title: true } });
  if (isSystemAnnouncementTitle(existing?.title)) {
    return NextResponse.json({ error: "Registro de sistema não pode ser removido aqui." }, { status: 400 });
  }
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
/**
 * Announcements feed endpoint.
 */
