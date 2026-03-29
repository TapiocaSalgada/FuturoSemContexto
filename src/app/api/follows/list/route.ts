import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type"); // "followers" | "following"

    if (!userId || !type) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    if (type === "followers") {
      const followers = await (prisma as any).follows.findMany({
        where: { followingId: userId },
        include: {
          follower: { select: { id: true, name: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json(followers.map((f: any) => f.follower));
    }

    if (type === "following") {
      const following = await (prisma as any).follows.findMany({
        where: { followerId: userId },
        include: {
          following: { select: { id: true, name: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json(following.map((f: any) => f.following));
    }

    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
