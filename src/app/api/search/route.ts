import { NextRequest, NextResponse } from "next/server";
import { getNavigationState } from "@/lib/navigation";
import prisma from "@/lib/prisma";
import { isPublicVisibility } from "@/lib/visibility";

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
  const navigation = await getNavigationState();

  if (q.length < 2) {
    return NextResponse.json({ animes: [], users: [] });
  }

  const [animes, users] = await Promise.all([
    prisma.anime.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, coverImage: true, status: true, visibility: true },
      take: 60,
    }),
    prisma.user.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, avatarUrl: true },
      take: 12,
    }),
  ]);

  const visibleAnimes = navigation.animeTabEnabled
    ? animes.filter((anime) => isPublicVisibility(anime.visibility))
    : [];

  const sortedAnimes = visibleAnimes
    .sort((a, b) => rankMatch(b.title, q) - rankMatch(a.title, q))
    .slice(0, 8)
    .map(({ visibility, ...anime }) => anime);

  const sortedUsers = users
    .sort((a, b) => rankMatch(b.name, q) - rankMatch(a.name, q))
    .slice(0, 5);

  return NextResponse.json(
    { animes: sortedAnimes, users: sortedUsers },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate" } },
  );
}
/**
 * Search endpoint for anime discovery surfaces.
 */
