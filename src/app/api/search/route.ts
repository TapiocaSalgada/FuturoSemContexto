import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) return NextResponse.json({ animes: [], users: [] });

  const [animes, users] = await Promise.all([
    prisma.anime.findMany({
      where: { title: { contains: q, mode: "insensitive" }, visibility: "public" },
      select: { id: true, title: true, coverImage: true, status: true },
      take: 8,
    }),
    prisma.user.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, avatarUrl: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({ animes, users });
}
