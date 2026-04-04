import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { reportMangaDexNetworkResult, verifyMangaDexImageToken } from "@/lib/mangadex";
import { getNavigationState } from "@/lib/navigation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const IMAGE_PROXY_TIMEOUT_MS = 12_000;

export async function GET(
  req: NextRequest,
  { params }: { params: { chapterId: string } },
) {
  const chapterId = String(params?.chapterId || "").trim();
  const token = String(req.nextUrl.searchParams.get("token") || "").trim();

  if (!chapterId) {
    return NextResponse.json({ error: "chapterId obrigatorio." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token de imagem obrigatorio." }, { status: 400 });
  }

  const [session, navigation] = await Promise.all([
    getServerSession(authOptions),
    getNavigationState(),
  ]);
  const isAdmin = (session?.user as any)?.role === "admin";

  if (!isAdmin && !navigation.mangaTabEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const chapter = await prisma.mangaChapter.findUnique({
    where: { id: chapterId },
    include: {
      manga: {
        select: { visibility: true },
      },
    },
  });

  if (!chapter || !chapter.manga) {
    return NextResponse.json({ error: "Capitulo nao encontrado." }, { status: 404 });
  }

  if (!isAdmin && chapter.manga.visibility === "admin_only") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourceUrl = verifyMangaDexImageToken(token, chapter.id);
  if (!sourceUrl) {
    return NextResponse.json({ error: "Token de imagem invalido ou expirado." }, { status: 403 });
  }

  const startedAt = Date.now();

  try {
    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(IMAGE_PROXY_TIMEOUT_MS)
        : undefined;

    const imageResponse = await fetch(sourceUrl, {
      cache: "no-store",
      signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    const durationMs = Date.now() - startedAt;
    const bytes = Number(imageResponse.headers.get("content-length") || 0) || undefined;
    const cacheSignal = String(
      imageResponse.headers.get("x-cache") || imageResponse.headers.get("cf-cache-status") || "",
    ).toUpperCase();

    void reportMangaDexNetworkResult({
      url: sourceUrl,
      success: imageResponse.ok,
      bytes,
      durationMs,
      cached: cacheSignal.includes("HIT"),
    });

    if (!imageResponse.ok || !imageResponse.body) {
      return NextResponse.json({ error: "Falha ao carregar pagina do capitulo." }, { status: 502 });
    }

    const responseHeaders = new Headers();
    const contentType = imageResponse.headers.get("content-type");
    const contentLength = imageResponse.headers.get("content-length");
    const etag = imageResponse.headers.get("etag");

    if (contentType) responseHeaders.set("Content-Type", contentType);
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (etag) responseHeaders.set("ETag", etag);

    responseHeaders.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    );
    responseHeaders.set("Vary", "Accept");
    responseHeaders.set("Cross-Origin-Resource-Policy", "same-origin");
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(imageResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    void reportMangaDexNetworkResult({
      url: sourceUrl,
      success: false,
      durationMs: Date.now() - startedAt,
    });

    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return NextResponse.json({ error: "Tempo limite ao carregar pagina do capitulo." }, { status: 504 });
    }

    return NextResponse.json({ error: "Erro ao carregar pagina do capitulo." }, { status: 500 });
  }
}
