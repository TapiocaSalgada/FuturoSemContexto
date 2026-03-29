import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 60; // Cache por 60 segundos
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const anime = await prisma.anime.findUnique({
    where: { id: params.id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { number: "asc" }], select: { id: true, title: true, number: true, season: true, duration: true, videoUrl: true, thumbnailUrl: true } },
      categories: true,
    },
  });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...anime,
    matchScore: 80 + (anime.title.length % 20)
  });
}
