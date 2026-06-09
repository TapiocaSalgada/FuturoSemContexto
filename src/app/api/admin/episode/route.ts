import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { createNotificationsForUsers } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { detectVideoSource } from "@/lib/video";
import { isEmbedMoviesProvider, isValidEmbedMoviesId, normalizeExternalIdType } from "@/lib/embedmovies";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ?parsed : null;
}

function resolveEpisodePlaybackSource({
  body,
  anime,
  season,
  number,
}: {
  body: any;
  anime?: { externalProvider?: string | null; externalId?: string | null; externalIdType?: string | null } | null;
  season: number;
  number: number;
}) {
  const videoUrl = String(body?.videoUrl || "").trim();
  const requestedProvider = String(body?.externalProvider || body?.sourceType || "").trim().toLowerCase();
  const useAnimeEmbedMovies = Boolean(body?.useAnimeEmbedMovies);
  const provider =
    requestedProvider === "embedmovies" || useAnimeEmbedMovies || (!videoUrl && isEmbedMoviesProvider(anime?.externalProvider))
      ?"embedmovies"
      : requestedProvider === "none"
        ?"none"
        : "manual";

  if (provider === "embedmovies") {
    const externalId = String(body?.externalId || anime?.externalId || "").trim();
    const externalIdType = normalizeExternalIdType(externalId, body?.externalIdType || anime?.externalIdType);
    if (!isValidEmbedMoviesId(externalId, externalIdType)) {
      throw new Error("Fonte EmbedMovies exige ID TMDb numérico ou IMDb começando com tt.");
    }

    return {
      videoUrl: null,
      sourceType: "embedmovies",
      sourceLabel: String(body?.sourceLabel || "EmbedMovies").trim() || "EmbedMovies",
      externalProvider: "embedmovies",
      externalId,
      externalIdType,
      externalSeason: season,
      externalEpisode: number,
    };
  }

  if (provider === "none") {
    return {
      videoUrl: null,
      sourceType: "external",
      sourceLabel: String(body?.sourceLabel || "").trim() || null,
      externalProvider: "none",
      externalId: null,
      externalIdType: null,
      externalSeason: null,
      externalEpisode: null,
    };
  }

  if (!videoUrl) {
    throw new Error("Anime e vídeo são obrigatórios.");
  }

  return {
    videoUrl,
    sourceType: detectVideoSource(videoUrl, body?.sourceType),
    sourceLabel: String(body?.sourceLabel || "").trim() || null,
    externalProvider: "manual",
    externalId: null,
    externalIdType: null,
    externalSeason: null,
    externalEpisode: null,
  };
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const {
      animeId,
      title,
      description,
      number,
      season,
      duration,
      status,
      thumbnailUrl,
      introStartSec,
      introEndSec,
      outroStartSec,
      outroEndSec,
    } = body;

    if (!animeId) {
      return new NextResponse("Anime é obrigatório.", { status: 400 });
    }

    const parsedNumber = parseInt(number, 10);
    const parsedSeason = parseInt(season, 10) || 1;
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      return new NextResponse("Número do episódio inválido.", { status: 400 });
    }

    const existing = await prisma.episode.findFirst({
      where: { animeId, season: parsedSeason, number: parsedNumber },
    });
    if (existing) {
      return new NextResponse(
        "Já existe episódio com essa temporada e número.",
        { status: 409 },
      );
    }

    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: { id: true, slug: true, title: true, externalProvider: true, externalId: true, externalIdType: true },
    });
    if (!anime) return new NextResponse("Anime não encontrado.", { status: 404 });

    const playbackSource = resolveEpisodePlaybackSource({
      body,
      anime,
      season: parsedSeason,
      number: parsedNumber,
    });

    const episode = await prisma.episode.create({
      data: {
        title: title || `Episódio ${parsedNumber}`,
        description: String(description || "").trim() || null,
        number: parsedNumber,
        season: parsedSeason,
        videoUrl: playbackSource.videoUrl,
        duration: String(duration || "").trim() || null,
        status: String(status || "published") === "draft" ?"draft" : "published",
        thumbnailUrl: String(thumbnailUrl || "").trim() || null,
        animeId,
        sourceType: playbackSource.sourceType,
        sourceLabel: playbackSource.sourceLabel,
        externalProvider: playbackSource.externalProvider,
        externalId: playbackSource.externalId,
        externalIdType: playbackSource.externalIdType,
        externalSeason: playbackSource.externalSeason,
        externalEpisode: playbackSource.externalEpisode,
        introStartSec: parseOptionalNumber(introStartSec),
        introEndSec: parseOptionalNumber(introEndSec),
        outroStartSec: parseOptionalNumber(outroStartSec),
        outroEndSec: parseOptionalNumber(outroEndSec),
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
        .filter((favorite) => favorite.user.settings?.notifyEpisodes === true)
        .map((favorite) => favorite.userId),
      {
        actorId: null,
        type: "new_episode",
        title: `${anime.title} recebeu um novo episódio`,
        body: `Temporada ${parsedSeason} episódio ${parsedNumber} já está disponível.`,
        link: `/assistir/${anime.slug || anime.id}/episodio-${episode.number}`,
      },
    );

    return NextResponse.json(episode);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("obrigat") || error.message.includes("EmbedMovies") || error.message.includes("TMDb"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Episode Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const {
      id,
      title,
      description,
      number,
      season,
      duration,
      status,
      sourceLabel,
      thumbnailUrl,
      introStartSec,
      introEndSec,
      outroStartSec,
      outroEndSec,
    } = body;
    if (!id) return new NextResponse("ID required", { status: 400 });

    const data: Record<string, unknown> = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: String(description || "").trim() || null }),
      ...(number !== undefined && { number: parseInt(number, 10) }),
      ...(season !== undefined && { season: parseInt(season, 10) }),
      ...(duration !== undefined && { duration: String(duration || "").trim() || null }),
      ...(status !== undefined && { status: String(status) === "draft" ?"draft" : "published" }),
      ...(sourceLabel !== undefined && { sourceLabel: String(sourceLabel || "").trim() || null }),
      ...(thumbnailUrl !== undefined && {
        thumbnailUrl: String(thumbnailUrl || "").trim() || null,
      }),
      ...(introStartSec !== undefined && {
        introStartSec: parseOptionalNumber(introStartSec),
      }),
      ...(introEndSec !== undefined && {
        introEndSec: parseOptionalNumber(introEndSec),
      }),
      ...(outroStartSec !== undefined && {
        outroStartSec: parseOptionalNumber(outroStartSec),
      }),
      ...(outroEndSec !== undefined && {
        outroEndSec: parseOptionalNumber(outroEndSec),
      }),
    };

    const playbackTouched =
      body?.videoUrl !== undefined ||
      body?.sourceType !== undefined ||
      body?.externalProvider !== undefined ||
      body?.externalId !== undefined ||
      body?.externalIdType !== undefined ||
      body?.useAnimeEmbedMovies !== undefined;

    if (playbackTouched) {
      const current = await prisma.episode.findUnique({
        where: { id },
        select: {
          season: true,
          number: true,
          anime: { select: { externalProvider: true, externalId: true, externalIdType: true } },
        },
      });
      if (!current) return new NextResponse("Episódio não encontrado.", { status: 404 });

      const parsedSeason = season !== undefined ?parseInt(season, 10) : current.season;
      const parsedNumber = number !== undefined ?parseInt(number, 10) : current.number;
      const playbackSource = resolveEpisodePlaybackSource({
        body,
        anime: current.anime,
        season: parsedSeason,
        number: parsedNumber,
      });
      Object.assign(data, playbackSource);
    }

    const episode = await prisma.episode.update({
      where: { id },
      data,
    });

    return NextResponse.json(episode);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("obrigat") || error.message.includes("EmbedMovies") || error.message.includes("TMDb"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
/**
 * Admin episode CRUD/update endpoint.
 */


