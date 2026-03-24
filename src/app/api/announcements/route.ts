import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const announcements = await prisma.announcement.findMany({
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
  return NextResponse.json(announcement);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
