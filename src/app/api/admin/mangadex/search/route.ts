import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  getMangaDexChapters,
  getMangaDexById,
  MangaDexApiError,
  MangaDexSearchResult,
  searchMangaDex,
} from "@/lib/mangadex";

function extractMangaDexId(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }

  const fromUrl = raw.match(/mangadex\.org\/title\/([0-9a-f-]{36})/i)?.[1];
  return fromUrl || "";
}

function decorateResult(item: MangaDexSearchResult) {
  return {
    ...item,
    coverImage: item.coverUrlHD || item.coverUrl || undefined,
    sourceUrl: `https://mangadex.org/title/${item.id}`,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() || "";
  const withChapters = req.nextUrl.searchParams.get("withChapters") === "1";
  const translatedOnly = req.nextUrl.searchParams.get("translatedOnly") === "1";

  if (!query) {
    return NextResponse.json({ error: "Query obrigatoria." }, { status: 400 });
  }

  try {
    const directId = extractMangaDexId(query);
    const directResult = directId ? await getMangaDexById(directId) : null;
    const results = (directResult ? [directResult] : await searchMangaDex(query)).map(decorateResult);

    if (!withChapters) {
      return NextResponse.json(results);
    }

    const lang = translatedOnly ? "pt-br" : "en";

    const enriched = await Promise.all(
      results.slice(0, 8).map(async (item) => {
        try {
          const chapterResult = await getMangaDexChapters(item.id, lang);
          return {
            ...item,
            chapterCount: chapterResult.total || chapterResult.chapters.length,
          };
        } catch {
          return {
            ...item,
            chapterCount: 0,
          };
        }
      }),
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    if (error instanceof MangaDexApiError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "MangaDex com limite temporario. Aguarde e tente novamente." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: `Falha na busca MangaDex (status ${error.status || "rede"}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: error?.message || "Falha na busca MangaDex." }, { status: 500 });
  }
}
