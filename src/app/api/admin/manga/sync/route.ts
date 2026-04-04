import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { findMangaMetadataByTitle } from "@/lib/mal";
import { getAllMangaDexChapters, MangaDexApiError } from "@/lib/mangadex";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const mangaId = String(body?.mangaId || "").trim();
  const translatedOnly = body?.translatedOnly !== false;
  const replaceChapters = body?.replaceChapters !== false;
  const enrichMetadata = body?.enrichMetadata !== false;
  const visibility =
    body?.visibility === "public"
      ? "public"
      : body?.visibility === "admin_only"
      ? "admin_only"
      : null;

  if (!mangaId) {
    return NextResponse.json({ error: "mangaId obrigatorio." }, { status: 400 });
  }

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, title: true, source: true, sourceId: true },
  });
  if (!manga) {
    return NextResponse.json({ error: "Manga nao encontrado." }, { status: 404 });
  }
  if (manga.source !== "mangadex" || !manga.sourceId) {
    return NextResponse.json({ error: "Este manga nao possui sourceId do MangaDex para sincronizar." }, { status: 400 });
  }

  try {
    const lang = translatedOnly ? "pt-br" : "en";
    const [chapterResult, malMetadata] = await Promise.all([
      getAllMangaDexChapters(manga.sourceId, lang),
      enrichMetadata ? findMangaMetadataByTitle(manga.title) : Promise.resolve(null),
    ]);

    const chapters = chapterResult.chapters;

    if (replaceChapters) {
      await prisma.mangaChapter.deleteMany({ where: { mangaId: manga.id } });
    }

    if (chapters.length > 0) {
      await prisma.mangaChapter.createMany({
        data: chapters.map((chapter: any) => ({
          mangaId: manga.id,
          externalId: chapter.id,
          chapterNumber: chapter.chapterNumber,
          volumeNumber: chapter.volumeNumber,
          title: chapter.title || null,
          language: chapter.language || null,
          pages: chapter.pages,
          scanlationTeam: chapter.scanlationTeam || null,
          externalUrl: chapter.externalUrl,
          publishedAt: chapter.publishedAt ? new Date(chapter.publishedAt) : null,
        })),
        skipDuplicates: true,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (visibility) {
      updateData.visibility = visibility;
    }

    if (translatedOnly) {
      updateData.language = "translated";
    }

    if (malMetadata) {
      updateData.description = malMetadata.synopsis || undefined;
      updateData.coverImage = malMetadata.imageUrl || undefined;
      updateData.bannerImage = malMetadata.imageUrl || undefined;
      updateData.malId = malMetadata.malId || undefined;
      updateData.malUrl = malMetadata.url || undefined;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.manga.update({
        where: { id: manga.id },
        data: updateData,
      });
    }

    const total = await prisma.mangaChapter.count({ where: { mangaId: manga.id } });

    return NextResponse.json({
      ok: true,
      imported: chapters.length,
      total,
      pagesFetched: chapterResult.pagesFetched,
      translatedOnly,
      malEnriched: Boolean(malMetadata),
      malLinked: Boolean(malMetadata?.malId || malMetadata?.url),
    });
  } catch (error: any) {
    if (error instanceof MangaDexApiError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "MangaDex com limite temporario. Aguarde e tente novamente." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: `Falha na sincronizacao MangaDex (status ${error.status || "rede"}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: error?.message || "Erro ao sincronizar manga." }, { status: 500 });
  }
}
