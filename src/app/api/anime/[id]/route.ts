import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const revalidate = 60; // Cache por 60 segundos
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";

  const anime = await prisma.anime.findUnique({
    where: { id: params.id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { number: "asc" }], select: { id: true, title: true, number: true, season: true, duration: true, videoUrl: true, thumbnailUrl: true } },
      categories: true,
    },
  });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && String(anime.visibility || "").toLowerCase() !== "public") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewers = await prisma.watchHistory.findMany({
    where: {
      episode: { animeId: params.id },
      OR: [
        { watched: true },
        { progressSec: { gte: 30 } },
      ],
    },
    distinct: ["userId"],
    select: { userId: true },
  });

  return NextResponse.json({
    ...anime,
    viewerCount: viewers.length,
    matchScore: 80 + (anime.title.length % 20)
  });
}
