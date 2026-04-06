import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getUserFromSession() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  // Try by ID first (from token), then by email
  const userId = (session.user as any)?.id;
  if (userId) {
    return prisma.user.findUnique({ where: { id: userId } });
  }
  if (session.user?.email) {
    return prisma.user.findUnique({ where: { email: session.user.email } });
  }
  return null;
}

export async function GET() {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folders = await prisma.favoriteFolder.findMany({
    where: { userId: user.id },
    include: {
      favorites: {
        where: { anime: { visibility: "public" } },
        include: { anime: { select: { id: true, title: true, coverImage: true, visibility: true } } },
      },
    },
  });
  return NextResponse.json(folders);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, isPrivate } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome da pasta é obrigatório." }, { status: 400 });

  const folder = await prisma.favoriteFolder.create({
    data: { userId: user.id, name: name.trim(), isPrivate: isPrivate ?? false },
  });
  return NextResponse.json(folder);
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, isPrivate } = await req.json();
  const folder = await prisma.favoriteFolder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.favoriteFolder.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(isPrivate !== undefined && { isPrivate }) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const folder = await prisma.favoriteFolder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.favoriteFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
