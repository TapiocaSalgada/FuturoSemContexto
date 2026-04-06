import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Toggle favorite with optional folder assignment
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { animeId, folderId } = await req.json();
  const existing = await prisma.favorite.findUnique({
    where: { userId_animeId: { userId: user.id, animeId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { userId_animeId: { userId: user.id, animeId } } });
    return NextResponse.json({ favorited: false });
  } else {
    const fav = await prisma.favorite.create({
      data: { userId: user.id, animeId, favoriteFolderId: folderId || null },
    });
    return NextResponse.json({ favorited: true, favorite: fav });
  }
}

// GET user's favorites
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: user.id,
      anime: { visibility: "public" },
    },
    include: {
      anime: { select: { id: true, title: true, coverImage: true, visibility: true } },
      folder: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(favorites);
}

// Delete favorite explicitly by animeId (for UI remove buttons)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { animeId } = await req.json();
  if (!animeId) return NextResponse.json({ error: "animeId required" }, { status: 400 });

  await prisma.favorite.deleteMany({ where: { userId: user.id, animeId } });
  return NextResponse.json({ ok: true });
}
