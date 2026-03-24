import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET user's folders
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const folders = await prisma.favoriteFolder.findMany({
    where: { userId: user.id },
    include: {
      favorites: {
        include: { anime: { select: { id: true, title: true, coverImage: true } } },
      },
    },
  });
  return NextResponse.json(folders);
}

// POST create a new folder
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name, isPrivate } = await req.json();
  const folder = await prisma.favoriteFolder.create({
    data: { userId: user.id, name, isPrivate: isPrivate ?? false },
  });
  return NextResponse.json(folder);
}

// PATCH update a folder
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id, name, isPrivate } = await req.json();
  const folder = await prisma.favoriteFolder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.favoriteFolder.update({ where: { id }, data: { name, isPrivate } });
  return NextResponse.json(updated);
}

// DELETE a folder
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await req.json();
  const folder = await prisma.favoriteFolder.findUnique({ where: { id } });
  if (!folder || folder.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.favoriteFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
