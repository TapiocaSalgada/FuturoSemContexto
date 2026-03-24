import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Search returns animes first (priority), then users (only if no anime matches exactly)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) return NextResponse.json({ animes: [], users: [] });

  const animes = await prisma.anime.findMany({
    where: {
      title: { contains: q },
      visibility: "public",
    },
    select: { id: true, title: true, coverImage: true, status: true },
    take: 10,
  });

  const users = await prisma.user.findMany({
    where: { name: { contains: q } },
    select: { id: true, name: true, avatarUrl: true },
    take: 5,
  });

  return NextResponse.json({ animes, users });
}
