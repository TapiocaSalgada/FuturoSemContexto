import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type FeedItem = {
  id: string;
  type: "watch" | "rating";
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  anime: { id: string; title: string; coverImage?: string | null };
  episode?: { id: string; number: number; season: number };
  rating?: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) return NextResponse.json([], { status: 200 });

  const [followingRows, followerRows] = await Promise.all([
    prisma.follows.findMany({
      where: { followerId: me.id },
      select: { followingId: true },
      take: 400,
    }),
    prisma.follows.findMany({
      where: { followingId: me.id },
      select: { followerId: true },
      take: 400,
    }),
  ]);

  const followerSet = new Set(followerRows.map((item) => item.followerId));
  const friendIds = followingRows
    .map((item) => item.followingId)
    .filter((id) => followerSet.has(id));

  if (friendIds.length === 0) return NextResponse.json([], { status: 200 });

  const socialVisibilityFilter = {
    OR: [
      { user: { settings: { is: null } } },
      { user: { settings: { is: { showHistory: true } } } },
    ],
  };

  const [watchEvents, ratingEvents] = await Promise.all([
    prisma.watchHistory.findMany({
      where: {
        userId: { in: friendIds },
        watched: true,
        episode: { anime: { visibility: "public" } },
        ...socialVisibilityFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        userId: true,
        episodeId: true,
        updatedAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        episode: {
          select: {
            id: true,
            number: true,
            season: true,
            anime: { select: { id: true, title: true, coverImage: true } },
          },
        },
      },
    }),
    prisma.animeRating.findMany({
      where: {
        userId: { in: friendIds },
        anime: { visibility: "public" },
        ...socialVisibilityFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        userId: true,
        animeId: true,
        rating: true,
        updatedAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        anime: { select: { id: true, title: true, coverImage: true } },
      },
    }),
  ]);

  const watchItems: FeedItem[] = watchEvents
    .filter((item) => item.episode?.anime)
    .map((item) => ({
      id: `watch-${item.userId}-${item.episodeId}-${item.updatedAt.getTime()}`,
      type: "watch",
      createdAt: item.updatedAt.toISOString(),
      user: item.user,
      anime: item.episode.anime,
      episode: {
        id: item.episode.id,
        number: item.episode.number,
        season: item.episode.season,
      },
    }));

  const ratingItems: FeedItem[] = ratingEvents
    .filter((item) => item.anime)
    .map((item) => ({
      id: `rating-${item.userId}-${item.animeId}-${item.updatedAt.getTime()}`,
      type: "rating",
      createdAt: item.updatedAt.toISOString(),
      user: item.user,
      anime: item.anime,
      rating: item.rating,
    }));

  const feed = [...watchItems, ...ratingItems]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 100);

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
