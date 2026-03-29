import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAchievements } from "@/lib/checkAchievements";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const animeId = searchParams.get("animeId");
    
    const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    if (animeId) {
      const history = await prisma.watchHistory.findFirst({
        where: { userId: user.id, episode: { animeId } },
        orderBy: { updatedAt: "desc" },
        select: { episodeId: true }
      });
      return NextResponse.json(history || { episodeId: null });
    }
    return NextResponse.json([]);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { episodeId, progressSec, watched } = await req.json();

    const userEmail = session.user.email as string;
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const history = await prisma.watchHistory.upsert({
      where: {
        userId_episodeId: {
          userId: user.id,
          episodeId,
        }
      },
      update: {
        progressSec,
        ...(watched !== undefined && { watched: Boolean(watched) }),
      },
      create: {
        userId: user.id,
        episodeId,
        progressSec,
        watched: Boolean(watched),
      }
    });

    // Only run achievement check when episode is marked as watched (not every 10s tick)
    if (watched) {
      checkAchievements(user.id).catch(() => {}); // fire-and-forget
    }

    return NextResponse.json(history);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

