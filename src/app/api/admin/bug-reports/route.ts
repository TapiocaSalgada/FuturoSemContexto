import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.bugReport.findMany({
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, email: true } },
      anime: { select: { id: true, title: true } },
      episode: { select: { id: true, number: true, season: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const id = String(body?.id || "");
  const status = String(body?.status || "").trim();
  if (!id || !status) {
    return NextResponse.json({ error: "id e status obrigatorios." }, { status: 400 });
  }

  const updated = await prisma.bugReport.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json({ error: "id obrigatorio." }, { status: 400 });
  }

  await prisma.bugReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
