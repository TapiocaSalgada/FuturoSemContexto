import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ACHIEVEMENTS, getAchievementById } from "@/lib/achievements";

// GET /api/achievements?userId=xxx  → return earned achievements for a user (with showOnProfile)
// GET /api/achievements              → return current user's achievements
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");

  const session = await getServerSession(authOptions);
  let currentUserId: string | null = null;
  if (session?.user?.email) {
    const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    currentUserId = me?.id ?? null;
  }

  const userId = targetUserId || currentUserId;
  if (!userId) return NextResponse.json([], { status: 200 });

  const earned = await prisma.userAchievement.findMany({
    where: {
      userId,
      // Only show hidden ones to the owner
      ...(userId !== currentUserId ? { showOnProfile: true } : {}),
    },
    orderBy: { earnedAt: "asc" },
  });

  const result = earned.map((ua) => ({
    ...ua,
    def: getAchievementById(ua.achievementId),
  })).filter((ua) => ua.def !== undefined);

  return NextResponse.json(result);
}

// POST /api/achievements  { achievementId }  → award to current user (idempotent)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { achievementId } = await req.json();
  if (!achievementId || !getAchievementById(achievementId)) {
    return NextResponse.json({ error: "Invalid achievementId" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const result = await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId: user.id, achievementId } },
    create: { userId: user.id, achievementId },
    update: {}, // already earned, do nothing
  });

  return NextResponse.json({ ok: true, achievement: result });
}

// PATCH /api/achievements  { achievementId, showOnProfile }  → toggle visibility
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { achievementId, showOnProfile } = await req.json();
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.userAchievement.update({
    where: { userId_achievementId: { userId: user.id, achievementId } },
    data: { showOnProfile },
  });

  return NextResponse.json({ ok: true });
}
/**
 * Achievements API endpoint for listing and progress updates.
 */
