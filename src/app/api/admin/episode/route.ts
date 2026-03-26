import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { createNotificationsForUsers } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { detectVideoSource } from "@/lib/video";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const {
      animeId,
      title,
      number,
      season,
      videoUrl,
      sourceLabel,
      introStartSec,
      introEndSec,
    } = await req.json();

    if (!animeId || !videoUrl?.trim()) {
      return new NextResponse("Anime e video sao obrigatorios.", { status: 400 });
    }

    const parsedNumber = parseInt(number, 10);
    const parsedSeason = parseInt(season, 10) || 1;
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      return new NextResponse("Numero do episodio invalido.", { status: 400 });
    }

    const existing = await prisma.episode.findFirst({
      where: { animeId, season: parsedSeason, number: parsedNumber },
    });
    if (existing) {
      return new NextResponse(
        "Ja existe episodio com essa temporada e numero.",
        { status: 409 },
      );
    }

    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: { id: true, title: true },
    });
    if (!anime) return new NextResponse("Anime nao encontrado.", { status: 404 });

    const episode = await prisma.episode.create({
      data: {
        title: title || `Episodio ${parsedNumber}`,
        number: parsedNumber,
        season: parsedSeason,
        videoUrl,
        animeId,
        sourceType: detectVideoSource(videoUrl),
        sourceLabel: sourceLabel?.trim() || null,
        introStartSec: parseOptionalNumber(introStartSec),
        introEndSec: parseOptionalNumber(introEndSec),
      },
    });

    const favorites = await prisma.favorite.findMany({
      where: { animeId },
      select: {
        userId: true,
        user: { select: { settings: { select: { notifyEpisodes: true } } } },
      },
    });

    await createNotificationsForUsers(
      favorites
        .filter((favorite) => favorite.user.settings?.notifyEpisodes !== false)
        .map((favorite) => favorite.userId),
      {
        actorId: null,
        type: "new_episode",
        title: `${anime.title} recebeu um novo episodio`,
        body: `Temporada ${parsedSeason} episodio ${parsedNumber} ja esta disponivel.`,
        link: `/watch/${episode.id}`,
      },
    );

    return NextResponse.json(episode);
  } catch (error) {
    console.error("Episode Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const {
      id,
      title,
      number,
      season,
      videoUrl,
      sourceLabel,
      introStartSec,
      introEndSec,
    } = await req.json();
    if (!id) return new NextResponse("ID required", { status: 400 });

    const episode = await prisma.episode.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(number !== undefined && { number: parseInt(number, 10) }),
        ...(season !== undefined && { season: parseInt(season, 10) }),
        ...(videoUrl !== undefined && {
          videoUrl,
          sourceType: detectVideoSource(videoUrl),
        }),
        ...(sourceLabel !== undefined && { sourceLabel: sourceLabel || null }),
        ...(introStartSec !== undefined && {
          introStartSec: parseOptionalNumber(introStartSec),
        }),
        ...(introEndSec !== undefined && {
          introEndSec: parseOptionalNumber(introEndSec),
        }),
      },
    });

    return NextResponse.json(episode);
  } catch (error) {
    console.error("Episode Update Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await req.json();
    if (!id) return new NextResponse("ID required", { status: 400 });

    await prisma.episode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Episode Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const animeId = searchParams.get("animeId");
    if (!animeId) return new NextResponse("animeId required", { status: 400 });

    const episodes = await prisma.episode.findMany({
      where: { animeId },
      orderBy: [{ season: "asc" }, { number: "asc" }],
    });

    return NextResponse.json(episodes);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
