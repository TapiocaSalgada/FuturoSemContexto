import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  const animeId = body?.animeId ? String(body.animeId) : null;
  const episodeId = body?.episodeId ? String(body.episodeId) : null;
  const pagePath = body?.pagePath ? String(body.pagePath) : null;
  const sourceUrl = body?.sourceUrl ? String(body.sourceUrl) : null;

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio." }, { status: 400 });
  }
  if (!description || description.length < 8) {
    return NextResponse.json({ error: "Descreva melhor o problema (min. 8 caracteres)." }, { status: 400 });
  }

  if (animeId) {
    const anime = await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
    if (!anime) {
      return NextResponse.json({ error: "Anime nao encontrado." }, { status: 404 });
    }
  }

  if (episodeId) {
    const episode = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true } });
    if (!episode) {
      return NextResponse.json({ error: "Episodio nao encontrado." }, { status: 404 });
    }
  }

  const report = await prisma.bugReport.create({
    data: {
      userId: user.id,
      animeId,
      episodeId,
      title,
      description,
      pagePath,
      sourceUrl,
    },
  });

  return NextResponse.json(report);
}
/**
 * User-facing bug report submit/list endpoint.
 */
