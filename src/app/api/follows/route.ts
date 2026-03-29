import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const type = searchParams.get("type"); // followers or following

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    if (type === "followers") {
      const followers = await prisma.follows.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, name: true, avatarUrl: true } } }
      });
      return NextResponse.json(followers.map(f => f.follower));
    }

    if (type === "following") {
      const following = await prisma.follows.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, name: true, avatarUrl: true } } }
      });
      return NextResponse.json(following.map(f => f.following));
    }

    const session = await getServerSession(authOptions);
    const currentUser = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;
    const [followersCount, followingCount, existingFollow] = await Promise.all([
      prisma.follows.count({ where: { followingId: userId } }),
      prisma.follows.count({ where: { followerId: userId } }),
      currentUser
        ? prisma.follows.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: userId,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      followersCount,
      followingCount,
      isFollowing: Boolean(existingFollow),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { targetId, followingId } = await req.json();
  const resolvedTargetId = targetId || followingId;
  if (!resolvedTargetId || resolvedTargetId === currentUser.id) return NextResponse.json({ error: "Invalid target" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({
    where: { id: resolvedTargetId },
    include: { settings: { select: { allowFollow: true, notifyFollowers: true } } },
  });
  if (!targetUser) return NextResponse.json({ error: "Target not found" }, { status: 404 });
  if (targetUser.settings?.allowFollow === false) {
    return NextResponse.json({ error: "Este perfil nao aceita novos seguidores." }, { status: 403 });
  }

  try {
    const existingFollow = await prisma.follows.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id, followingId: resolvedTargetId } }
    });

    if (existingFollow) {
      await prisma.follows.delete({
        where: { followerId_followingId: { followerId: currentUser.id, followingId: resolvedTargetId } }
      });
      return NextResponse.json({ following: false });
    } else {
      await prisma.follows.create({
        data: { followerId: currentUser.id, followingId: resolvedTargetId }
      });
      if (targetUser.settings?.notifyFollowers !== false) {
        await createNotification({
          userId: targetUser.id,
          actorId: currentUser.id,
          type: "follow",
          title: `${currentUser.name} comecou a seguir voce`,
          body: "Seu perfil ganhou um novo seguidor.",
          link: `/profile/${currentUser.id}`,
        });
      }
      return NextResponse.json({ following: true });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to toggle follow" }, { status: 500 });
  }
}
