import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Toggle follow/unfollow
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

// GET follow status + counts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const [followersCount, followingCount] = await Promise.all([
    prisma.follows.count({ where: { followingId: userId } }),
    prisma.follows.count({ where: { followerId: userId } }),
  ]);

  let isFollowing = false;
  if (session?.user?.email) {
    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (me) {
      const f = await prisma.follows.findUnique({
        where: { followerId_followingId: { followerId: me.id, followingId: userId } },
      });
      isFollowing = !!f;
    }
  }

  return NextResponse.json({ followersCount, followingCount, isFollowing });
}
