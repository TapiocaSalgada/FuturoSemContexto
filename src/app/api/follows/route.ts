import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const type = searchParams.get("type"); // followers or following

  if (!userId || !type) return NextResponse.json({ error: "userId and type required" }, { status: 400 });

  try {
    if (type === "followers") {
      const followers = await prisma.follows.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, name: true, avatarUrl: true } } }
      });
      return NextResponse.json(followers.map(f => f.follower));
    } else {
      const following = await prisma.follows.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, name: true, avatarUrl: true } } }
      });
      return NextResponse.json(following.map(f => f.following));
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { targetId } = await req.json();
  if (!targetId || targetId === currentUser.id) return NextResponse.json({ error: "Invalid target" }, { status: 400 });

  try {
    const existingFollow = await prisma.follows.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id, followingId: targetId } }
    });

    if (existingFollow) {
      await prisma.follows.delete({
        where: { followerId_followingId: { followerId: currentUser.id, followingId: targetId } }
      });
      return NextResponse.json({ following: false });
    } else {
      await prisma.follows.create({
        data: { followerId: currentUser.id, followingId: targetId }
      });
      return NextResponse.json({ following: true });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to toggle follow" }, { status: 500 });
  }
}
