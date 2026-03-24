import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET comments for an anime
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId");
  if (!animeId) return NextResponse.json({ error: "animeId required" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { animeId, parentId: null },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      replies: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(comments);
}

// POST new comment
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check timeout
  if (user.isTimedOut && new Date(user.isTimedOut) > new Date()) {
    return NextResponse.json({ error: "You are timed out" }, { status: 403 });
  }

  const { animeId, content, parentId } = await req.json();
  const comment = await prisma.comment.create({
    data: { content, animeId, userId: user.id, parentId: parentId || null },
    include: { user: { select: { id: true, name: true, avatarUrl: true } }, replies: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
  return NextResponse.json(comment);
}

// PATCH edit a comment
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id, content } = await req.json();
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.comment.update({ where: { id }, data: { content } });
  return NextResponse.json(updated);
}

// DELETE a comment
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await req.json();
  const comment = await prisma.comment.findUnique({ where: { id } });
  // @ts-expect-error role
  if (!comment || (comment.userId !== user.id && session.user?.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
