import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/ratings?animeId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId");
  if (!animeId) return NextResponse.json({ error: "animeId required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  let userRating: number | null = null;

  const [agg, userRecord] = await Promise.all([
    prisma.animeRating.aggregate({
      where: { animeId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    session?.user?.email
      ? prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }).then((u) =>
          u ? prisma.animeRating.findUnique({ where: { userId_animeId: { userId: u.id, animeId } } }) : null
        )
      : Promise.resolve(null),
  ]);

  if (userRecord) userRating = (userRecord as any).rating;

  return NextResponse.json({
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    total: agg._count.rating,
    userRating,
  });
}

// POST /api/ratings  { animeId, rating }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { animeId, rating } = await req.json();
  if (!animeId || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.animeRating.upsert({
    where: { userId_animeId: { userId: user.id, animeId } },
    create: { userId: user.id, animeId, rating },
    update: { rating },
  });

  // Award achievements
  const totalRated = await prisma.animeRating.count({ where: { userId: user.id } });
  if (totalRated === 1) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId: user.id, achievementId: "first_rating" } },
      create: { userId: user.id, achievementId: "first_rating" },
      update: {},
    });
  }
  if (totalRated >= 10) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId: user.id, achievementId: "active_rater" } },
      create: { userId: user.id, achievementId: "active_rater" },
      update: {},
    });
  }

  const newAgg = await prisma.animeRating.aggregate({
    where: { animeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return NextResponse.json({
    ok: true,
    average: newAgg._avg.rating ? Math.round(newAgg._avg.rating * 10) / 10 : null,
    total: newAgg._count.rating,
    userRating: rating,
  });
}
