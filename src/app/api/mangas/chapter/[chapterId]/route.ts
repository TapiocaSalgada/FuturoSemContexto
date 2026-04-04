import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  buildMangaDexProxyImageUrls,
  buildMangaDexSourceImageUrl,
  getMangaDexAtHomeServer,
  MangaDexApiError,
} from "@/lib/mangadex";
import { getNavigationState } from "@/lib/navigation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { chapterId: string } }) {
  const [session, navigation] = await Promise.all([
    getServerSession(authOptions),
    getNavigationState(),
  ]);
  const isAdmin = (session?.user as any)?.role === "admin";

  if (!isAdmin && !navigation.mangaTabEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const chapterId = String(params?.chapterId || "").trim();
  if (!chapterId) {
    return NextResponse.json({ error: "chapterId obrigatorio." }, { status: 400 });
  }

  const chapter = await prisma.mangaChapter.findUnique({
    where: { id: chapterId },
    include: {
      manga: {
        select: { id: true, title: true, visibility: true },
      },
    },
  });

  if (!chapter || !chapter.manga) {
    return NextResponse.json({ error: "Capitulo nao encontrado." }, { status: 404 });
  }

  if (!isAdmin && chapter.manga.visibility === "admin_only") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!chapter.externalId) {
    return NextResponse.json({ error: "Capitulo sem externalId do MangaDex." }, { status: 400 });
  }

  const lowQuality = req.nextUrl.searchParams.get("quality") === "low";

  try {
    const atHome = await getMangaDexAtHomeServer(chapter.externalId);
    if (!atHome) {
      return NextResponse.json({ error: "Falha ao carregar imagens do capitulo." }, { status: 502 });
    }

    const files =
      lowQuality && atHome.dataSaver.length > 0
        ? atHome.dataSaver
        : atHome.data;
    const folder = lowQuality ? "data-saver" : "data";

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "Nao foi possivel montar as paginas do capitulo." }, { status: 502 });
    }

    const sourceUrls = files
      .map((file) => String(file || "").trim())
      .filter(Boolean)
      .map((file) => buildMangaDexSourceImageUrl(atHome.baseUrl, folder, atHome.hash, file))
      .filter(Boolean);

    const images = buildMangaDexProxyImageUrls({
      chapterId: chapter.id,
      sourceUrls,
      ttlSeconds: 15 * 60,
    });

    if (images.length === 0) {
      return NextResponse.json({ error: "Nao foi possivel montar as paginas do capitulo." }, { status: 502 });
    }

    return NextResponse.json({
      chapter: {
        id: chapter.id,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        volumeNumber: chapter.volumeNumber,
        mangaId: chapter.manga.id,
        mangaTitle: chapter.manga.title,
      },
      quality: lowQuality ? "low" : "high",
      pages: images.length,
      images,
    });
  } catch (error) {
    if (error instanceof MangaDexApiError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "MangaDex com limite de requisicoes temporario. Tente novamente." },
          { status: 503 },
        );
      }

      return NextResponse.json({ error: "Falha ao carregar leitor interno." }, { status: 502 });
    }

    return NextResponse.json({ error: "Erro ao carregar leitor interno." }, { status: 500 });
  }
}
