import { NextRequest, NextResponse } from "next/server";

import { listPublicCatalogItems, searchPublicCatalogItems } from "@/lib/catalog/compat";
import prisma from "@/lib/prisma";

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function rankMatch(value: string, query: string) {
  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedValue === normalizedQuery) return 3;
  if (normalizedValue.startsWith(normalizedQuery)) return 2;
  return normalizedValue.includes(normalizedQuery) ? 1 : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 10_000);
  const limit = parseBoundedInt(searchParams.get("limit"), q ? 30 : 42, 1, 80);
  const includeUsers = searchParams.get("users") !== "0";

  if (q.length > 0 && q.length < 2) {
    return NextResponse.json(
      { animes: [], items: [], users: [], hasMore: false, nextOffset: null, mode: "search", hint: "min_query" },
      { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" } },
    );
  }

  const searchMode = q.length >= 2;
  const allItems = searchMode
    ? await searchPublicCatalogItems(q, offset + limit + 1)
    : await listPublicCatalogItems(offset + limit + 1);
  const pageItems = allItems.slice(offset, offset + limit + 1);
  const visibleItems = pageItems.slice(0, limit);
  const hasMore = pageItems.length > limit;

  const users =
    includeUsers && searchMode && offset === 0
      ? await prisma.user.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          select: { id: true, name: true, avatarUrl: true },
          take: 20,
        })
      : [];

  const rankedUsers = users
    .sort((left, right) => rankMatch(right.name, q) - rankMatch(left.name, q))
    .slice(0, 8);

  const animes = visibleItems.map((item) => ({
    ...item,
    coverImage: item.posterUrl,
    bannerImage: item.bannerUrl,
  }));

  return NextResponse.json(
    {
      animes,
      items: visibleItems,
      users: rankedUsers,
      hasMore,
      nextOffset: hasMore ? offset + visibleItems.length : null,
      nextCursor: null,
      mode: searchMode ? "search" : "discover",
    },
    {
      headers: {
        "Cache-Control": searchMode
          ? "s-maxage=20, stale-while-revalidate=45"
          : "s-maxage=45, stale-while-revalidate=120",
      },
    },
  );
}
