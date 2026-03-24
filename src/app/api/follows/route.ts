import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST to follow a user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const follower = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!follower) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { followingId } = await req.json();
  if (follower.id === followingId) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const existing = await prisma.follows.findUnique({
    where: { followerId_followingId: { followerId: follower.id, followingId } },
  });

  if (existing) {
    await prisma.follows.delete({ where: { followerId_followingId: { followerId: follower.id, followingId } } });
    return NextResponse.json({ following: false });
  } else {
    await prisma.follows.create({ data: { followerId: follower.id, followingId } });
    return NextResponse.json({ following: true });
  }
}

// GET follow status and counts for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  let isFollowing = false;

  if (session?.user?.email) {
    const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (currentUser) {
      const follow = await prisma.follows.findUnique({
        where: { followerId_followingId: { followerId: currentUser.id, followingId: userId } },
      });
      isFollowing = !!follow;
    }
  }

  const followersCount = await prisma.follows.count({ where: { followingId: userId } });
  const followingCount = await prisma.follows.count({ where: { followerId: userId } });

  return NextResponse.json({ followersCount, followingCount, isFollowing });
}
