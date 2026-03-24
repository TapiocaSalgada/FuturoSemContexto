import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { animeId, title, number, season, videoUrl } = await req.json();

    const episode = await prisma.episode.create({
      data: {
        title: title || `Episódio ${number}`,
        number: parseInt(number),
        season: parseInt(season) || 1,
        videoUrl,
        animeId,
      },
    });

    return NextResponse.json(episode);
  } catch (error) {
    console.error("Episode Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
