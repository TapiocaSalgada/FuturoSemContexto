import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAchievements } from "@/lib/checkAchievements";

export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function parseJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const animeId = String(searchParams.get("animeId") || "").trim();

    const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
    if (!user) return jsonError("User not found", 404);

    const isAdmin = (session.user as any)?.role === "admin";

    if (animeId) {
      const history = await prisma.watchHistory.findFirst({
        where: {
          userId: user.id,
          episode: {
            animeId,
            ...(isAdmin ? {} : { anime: { visibility: "public" } }),
          },
        },
        orderBy: { updatedAt: "desc" },
        select: { episodeId: true },
      });

      return NextResponse.json({ episodeId: history?.episodeId || null });
    }

    const list = await prisma.watchHistory.findMany({
      where: {
        userId: user.id,
        ...(isAdmin ? {} : { episode: { anime: { visibility: "public" } } }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        episode: {
          include: {
            anime: { select: { id: true, title: true, coverImage: true, bannerImage: true, visibility: true } },
          },
        },
      },
      take: 100,
    });

    return NextResponse.json(list);
  } catch {
    return jsonError("Internal Error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return jsonError("Unauthorized", 401);
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const episodeId = String(body?.episodeId || "").trim();
    if (!episodeId) {
      return jsonError("episodeId required", 400);
    }

    const progressRaw = Number(body?.progressSec ?? 0);
    const progressSec = Number.isFinite(progressRaw) ? Math.max(0, Math.floor(progressRaw)) : 0;
    const watched = body?.watched === true;

    const userEmail = session.user.email as string;
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return jsonError("User not found", 404);

    const isAdmin = (session.user as any)?.role === "admin";
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { anime: { select: { visibility: true } } },
    });

    if (!episode) {
      return jsonError("Episode not found", 404);
    }

    if (!isAdmin && String(episode.anime.visibility || "").toLowerCase() !== "public") {
      return jsonError("Not found", 404);
    }

    const history = await prisma.watchHistory.upsert({
      where: {
        userId_episodeId: {
          userId: user.id,
          episodeId,
        },
      },
      update: {
        progressSec,
        ...(watched ? { watched: true } : {}),
      },
      create: {
        userId: user.id,
        episodeId,
        progressSec,
        watched,
      },
    });

    // Only run achievement check when episode is marked as watched (not every 10s tick)
    if (watched) {
      checkAchievements(user.id).catch(() => {}); // fire-and-forget
    }

    return NextResponse.json(history);
  } catch {
    return jsonError("Internal Error", 500);
  }
}

// Delete a history entry (by episodeId or animeId) or clear all for user
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).email) {
      return jsonError("Unauthorized", 401);
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const episodeId = String(body?.episodeId || "").trim();
    const animeId = String(body?.animeId || "").trim();
    const all = body?.all === true;

    const user = await prisma.user.findUnique({ where: { email: (session.user as any).email } });
    if (!user) return jsonError("User not found", 404);

    if (all) {
      const result = await prisma.watchHistory.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ ok: true, cleared: true, deleted: result.count });
    }

    if (!episodeId && !animeId) {
      return jsonError("episodeId or animeId required", 400);
    }

    if (animeId) {
      const result = await prisma.watchHistory.deleteMany({ where: { userId: user.id, episode: { animeId } } });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    const result = await prisma.watchHistory.deleteMany({ where: { userId: user.id, episodeId } });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch {
    return jsonError("Internal Error", 500);
  }
}

