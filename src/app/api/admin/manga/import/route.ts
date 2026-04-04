import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { findMangaMetadataByTitle } from "@/lib/mal";
import {
  getAllMangaDexChapters,
  getMangaDexById,
  MangaDexApiError,
  searchMangaDex,
} from "@/lib/mangadex";
import prisma from "@/lib/prisma";

function slugifyCategory(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function resolveCategoryIds(categoryNames: string[]) {
  const uniqueNames = Array.from(new Set(categoryNames.map((name) => name.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) return [] as string[];

  const pairs = uniqueNames
    .map((name) => ({ name, slug: slugifyCategory(name) }))
    .filter((item) => item.slug);

  if (pairs.length === 0) return [] as string[];

  const existing = await prisma.category.findMany({
    where: { slug: { in: pairs.map((pair) => pair.slug) } },
    select: { id: true, slug: true },
  });

  const bySlug = new Map(existing.map((item) => [item.slug, item.id]));
  const resolvedIds = [...existing.map((item) => item.id)];

  for (const pair of pairs) {
    if (bySlug.has(pair.slug)) continue;
    const created = await prisma.category.create({
      data: { name: pair.name, slug: pair.slug },
      select: { id: true, slug: true },
    });
    bySlug.set(created.slug, created.id);
    resolvedIds.push(created.id);
  }

  return resolvedIds;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const mangaDexId = String(body?.mangaDexId || "").trim();
  const translatedOnly = body?.translatedOnly === true;
  const visibility = body?.visibility === "admin_only" ? "admin_only" : "public";
  const malEnrich = body?.malEnrich !== false;

  if (!mangaDexId) {
    return NextResponse.json({ error: "mangaDexId obrigatorio." }, { status: 400 });
  }

  try {
    const directLookup = await getMangaDexById(mangaDexId);
    const selected =
      directLookup ||
      (await searchMangaDex(String(body?.title || mangaDexId))).find((item) => item.id === mangaDexId) ||
      null;

    if (!selected) {
      return NextResponse.json({ error: "Manga nao encontrado no MangaDex." }, { status: 404 });
    }

    const lang = translatedOnly ? "pt-br" : "en";
    const [chapterResult, malMetadata] = await Promise.all([
      getAllMangaDexChapters(mangaDexId, lang),
      malEnrich ? findMangaMetadataByTitle(selected.title) : Promise.resolve(null),
    ]);

    const chapters = chapterResult.chapters;

    const categoryNames = [
      ...(Array.isArray(body?.categoryNames) ? body.categoryNames : []),
      ...(selected.tags || []),
      ...(selected.demographics || []),
      ...(malMetadata?.genres || []),
      ...(malMetadata?.themes || []),
      ...(malMetadata?.demographics || []),
    ];
    const categoryIds = await resolveCategoryIds(categoryNames);

    const mangaDexUrl = `https://mangadex.org/title/${mangaDexId}`;

    const existing = await prisma.manga.findFirst({
      where: {
        OR: [{ source: "mangadex", sourceId: mangaDexId }, { title: { equals: selected.title, mode: "insensitive" } }],
      },
      select: { id: true },
    });

    const manga = existing
      ? await prisma.manga.update({
          where: { id: existing.id },
          data: {
            title: selected.title,
            description: selected.description || malMetadata?.synopsis || null,
            coverImage: selected.coverUrlHD || selected.coverUrl || malMetadata?.imageUrl || null,
            bannerImage: malMetadata?.imageUrl || selected.coverUrlHD || null,
            malId: malMetadata?.malId || null,
            malUrl: malMetadata?.url || null,
            visibility,
            source: "mangadex",
            sourceId: mangaDexId,
            sourceUrl: mangaDexUrl,
            language: translatedOnly ? "translated" : null,
            categories: {
              set: categoryIds.map((id) => ({ id })),
            },
          },
        })
      : await prisma.manga.create({
          data: {
            title: selected.title,
            description: selected.description || malMetadata?.synopsis || null,
            coverImage: selected.coverUrlHD || selected.coverUrl || malMetadata?.imageUrl || null,
            bannerImage: malMetadata?.imageUrl || selected.coverUrlHD || null,
            malId: malMetadata?.malId || null,
            malUrl: malMetadata?.url || null,
            visibility,
            status: "ongoing",
            source: "mangadex",
            sourceId: mangaDexId,
            sourceUrl: mangaDexUrl,
            language: translatedOnly ? "translated" : null,
            ...(categoryIds.length > 0
              ? {
                  categories: {
                    connect: categoryIds.map((id) => ({ id })),
                  },
                }
              : {}),
          },
        });

    if (body?.replaceChapters !== false) {
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

    const mangaWithCount = await prisma.manga.findUnique({
      where: { id: manga.id },
      include: { chapters: { select: { id: true } } },
    });

    return NextResponse.json({
      ok: true,
      mangaId: manga.id,
      title: manga.title,
      importedChapters: chapters.length,
      totalChapters: mangaWithCount?.chapters.length || chapters.length,
      pagesFetched: chapterResult.pagesFetched,
      malAttempted: malEnrich,
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
        { error: `Falha na importacao MangaDex (status ${error.status || "rede"}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: error?.message || "Erro ao importar manga." }, { status: 500 });
  }
}
