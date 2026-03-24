import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { episodeId, progressSec } = await req.json();

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
      update: { progressSec },
      create: {
        userId: user.id,
        episodeId,
        progressSec
      }
    });

    return NextResponse.json(history);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
