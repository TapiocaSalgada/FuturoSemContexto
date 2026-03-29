import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type"); // 'followers' or 'following'

    if (!userId || !type) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    if (type === "followers") {
      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: { id: true, name: true, avatarUrl: true, isPrivate: true, bio: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(followers.map(f => f.follower));
    }

    if (type === "following") {
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: { id: true, name: true, avatarUrl: true, isPrivate: true, bio: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(following.map(f => f.following));
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
