import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function rankMatch(value: string, query: string) {
  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedValue === normalizedQuery) return 3;
  if (normalizedValue.startsWith(normalizedQuery)) return 2;
  return normalizedValue.includes(normalizedQuery) ? 1 : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) return NextResponse.json({ animes: [], users: [] });

  const [animes, users] = await Promise.all([
    prisma.anime.findMany({
      where: { title: { contains: q, mode: "insensitive" }, visibility: "public" },
      select: { id: true, title: true, coverImage: true, status: true },
      take: 20,
    }),
    prisma.user.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, avatarUrl: true },
      take: 12,
    }),
  ]);

  const sortedAnimes = animes
    .sort((a, b) => rankMatch(b.title, q) - rankMatch(a.title, q))
    .slice(0, 8);
  const sortedUsers = users
    .sort((a, b) => rankMatch(b.name, q) - rankMatch(a.name, q))
    .slice(0, 5);

  return NextResponse.json(
    { animes: sortedAnimes, users: sortedUsers },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate" } }
  );
}
