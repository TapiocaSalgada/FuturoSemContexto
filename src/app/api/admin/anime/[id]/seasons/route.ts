import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return isSiteAdmin(session as any) ?session : null;
}

function normalizeSeasonNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeSeasonStatus(value: unknown) {
  return String(value || "published") === "draft" ?"draft" : "published";
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const animeId = params.id;
  const [seasonRows, episodes] = await Promise.all([
    prisma.animeSeason.findMany({ where: { animeId }, orderBy: { number: "asc" } }),
    prisma.episode.findMany({ where: { animeId }, orderBy: [{ season: "asc" }, { number: "asc" }] }),
  ]);

  const byNumber = new Map<number, any>();
  for (const season of seasonRows) {
    byNumber.set(season.number, { ...season, episodes: [] });
  }
  for (const episode of episodes) {
    const number = episode.season || 1;
    if (!byNumber.has(number)) {
      byNumber.set(number, {
        id: null,
        animeId,
        number,
        name: null,
        description: null,
        status: "published",
        virtual: true,
        episodes: [],
      });
    }
    byNumber.get(number).episodes.push(episode);
  }

  return NextResponse.json({ seasons: Array.from(byNumber.values()).sort((a, b) => a.number - b.number) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const number = normalizeSeasonNumber(body?.number);
  if (!number) return NextResponse.json({ error: "Número da temporada inválido." }, { status: 400 });

  const animeId = params.id;
  const anime = await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
  if (!anime) return NextResponse.json({ error: "Anime não encontrado." }, { status: 404 });

  const season = await prisma.animeSeason.upsert({
    where: { animeId_number: { animeId, number } },
    create: {
      animeId,
      number,
      name: String(body?.name || "").trim() || null,
      description: String(body?.description || "").trim() || null,
      status: normalizeSeasonStatus(body?.status),
    },
    update: {
      name: String(body?.name || "").trim() || null,
      description: String(body?.description || "").trim() || null,
      status: normalizeSeasonStatus(body?.status),
    },
  });

  return NextResponse.json(season);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const number = normalizeSeasonNumber(body?.number);
  const force = Boolean(body?.force);
  if (!number) return NextResponse.json({ error: "Número da temporada inválido." }, { status: 400 });

  const animeId = params.id;
  const count = await prisma.episode.count({ where: { animeId, season: number } });
  if (count > 0 && !force) {
    return NextResponse.json({ error: "Esta temporada ainda tem episódios. Confirme para excluir temporada e episódios." }, { status: 409 });
  }

  await prisma.$transaction([
    ...(force ?[prisma.episode.deleteMany({ where: { animeId, season: number } })] : []),
    prisma.animeSeason.deleteMany({ where: { animeId, number } }),
  ]);

  return NextResponse.json({ ok: true });
}
