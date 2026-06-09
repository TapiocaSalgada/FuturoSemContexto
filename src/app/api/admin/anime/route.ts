import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidateTag } from "next/cache";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import { searchAnimeMetadataOptions } from "@/lib/anime-metadata";
import { isValidEmbedMoviesId, normalizeExternalIdType } from "@/lib/embedmovies";

function isAdmin(session: any) {
  return isSiteAdmin(session);
}

function normalizeVisibility(value: unknown): "public" | "admin_only" {
  const current = String(value || "").trim().toLowerCase();
  if (current === "public") return "public";
  if (current === "admin_only" || current === "private") return "admin_only";
  return "public";
}

function toVisibilityForClient(value: unknown): "public" | "admin_only" {
  return String(value || "").trim().toLowerCase() === "public" ?"public" : "admin_only";
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeMediaType(value: unknown) {
  const current = String(value || "").trim().toLowerCase();
  if (current === "movie" || current === "filme") return "movie";
  if (current === "serie" || current === "series" || current === "série") return "serie";
  return "anime";
}

function normalizeExternalProvider(value: unknown) {
  const current = String(value || "").trim().toLowerCase();
  if (current === "embedmovies") return "embedmovies";
  if (current === "none" || current === "sem_fonte") return "none";
  return "manual";
}

function normalizeExternalPlayback(body: any) {
  const externalProvider = normalizeExternalProvider(body?.externalProvider);
  const externalId = normalizeText(body?.externalId);
  const externalIdType = normalizeExternalIdType(externalId, body?.externalIdType);
  const mediaType = normalizeMediaType(body?.mediaType);

  if (externalProvider === "embedmovies" && !isValidEmbedMoviesId(externalId, externalIdType)) {
    throw new Error("Informe um ID TMDb numérico ou IMDb começando com tt.");
  }

  if (externalProvider !== "embedmovies") {
    return {
      externalProvider,
      externalId: null,
      externalIdType: null,
      mediaType,
    };
  }

  return {
    externalProvider,
    externalId,
    externalIdType,
    mediaType,
  };
}

function normalizeImage(value: unknown) {
  const current = normalizeText(value);
  if (!current) return "";
  if (current.startsWith("http://")) {
    return `https://${current.slice(7)}`;
  }
  return current;
}

function isSameImage(leftInput: string, rightInput: string) {
  const left = normalizeImage(leftInput);
  const right = normalizeImage(rightInput);
  if (!left || !right) return false;
  if (left === right) return true;

  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return (
      leftUrl.hostname.toLowerCase() === rightUrl.hostname.toLowerCase() &&
      leftUrl.pathname === rightUrl.pathname
    );
  } catch {
    return false;
  }
}

function resolveArtworkPair(coverInput: unknown, bannerInput: unknown) {
  let coverImage = normalizeImage(coverInput);
  let bannerImage = normalizeImage(bannerInput);

  if (!coverImage && bannerImage) {
    coverImage = bannerImage;
  }
  if (coverImage && bannerImage && isSameImage(coverImage, bannerImage)) {
    bannerImage = "";
  }

  return { coverImage, bannerImage };
}

function portugueseHintScore(value: string) {
  const text = String(value || "").toLowerCase();
  if (!text) return 0;

  let score = 0;
  const hints = [
    "sinopse",
    "episodio",
    "episódio",
    "temporada",
    "lançamento",
    "lancamento",
    "história",
    "historia",
    "personagem",
    "dublado",
    "legendado",
    "ação",
    "acao",
  ];

  for (const hint of hints) {
    if (text.includes(hint)) score += 1;
  }

  if (/[ãõáéíóúàâêôç]/i.test(text)) score += 2;
  return score;
}

function shouldTranslateToPtBr(value: string) {
  const text = String(value || "").trim();
  if (!text || text.length < 18) return false;
  return portugueseHintScore(text) < 2;
}

async function translateToPtBr(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;

  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "auto");
  endpoint.searchParams.set("tl", "pt-BR");
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", trimmed.slice(0, 3800));

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return trimmed;

    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ?payload[0].map((chunk: any) => String(chunk?.[0] || "")).join("")
      : "";
    return translated.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

async function ensurePortugueseSynopsis(value: string) {
  const current = String(value || "").trim();
  if (!current) return "";
  if (!shouldTranslateToPtBr(current)) return current;
  return translateToPtBr(current);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { title, description, coverImage, bannerImage, status, visibility, autoMedia } = body || {};
    if (!title) return new NextResponse("Título obrigatório.", { status: 400 });
    const externalPlayback = normalizeExternalPlayback(body);

    const existing = await prisma.anime.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Anime já existe no catálogo.", existingId: existing.id },
        { status: 409 },
      );
    }

    let resolvedDescription = typeof description === "string" ?description.trim() : "";
    let resolvedCoverImage = typeof coverImage === "string" ?normalizeImage(coverImage) : "";
    let resolvedBannerImage = typeof bannerImage === "string" ?normalizeImage(bannerImage) : "";

    if (autoMedia !== false && (!resolvedCoverImage || !resolvedBannerImage || !resolvedDescription)) {
      const [media] = await searchAnimeMetadataOptions(String(title), 1);
      if (media) {
        if (media.coverImage) {
          if (!resolvedCoverImage) resolvedCoverImage = normalizeImage(media.coverImage);
          if (!resolvedBannerImage) resolvedBannerImage = normalizeImage(media.bannerImage || media.coverImage);
        }
        if (!resolvedDescription && media.description) {
          resolvedDescription = media.description.trim();
        }
      }
    }

    if (autoMedia !== false && resolvedDescription) {
      resolvedDescription = await ensurePortugueseSynopsis(resolvedDescription);
    }

    const { coverImage: compatibleCover, bannerImage: compatibleBanner } = resolveArtworkPair(
      resolvedCoverImage,
      resolvedBannerImage,
    );

    const anime = await prisma.anime.create({
      data: {
        title,
        description: resolvedDescription || null,
        coverImage: compatibleCover || null,
        bannerImage: compatibleBanner || null,
        status: status || "ongoing",
        visibility: normalizeVisibility(visibility),
        ...externalPlayback,
      },
    });

    revalidateTag("recent-animes-home");
    return NextResponse.json(anime);
  } catch (error) {
    if (error instanceof Error && error.message.includes("ID TMDb")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Anime Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { id, title, description, coverImage, bannerImage, status, visibility, autoMedia } = body || {};
    if (!id) return new NextResponse("ID obrigatório.", { status: 400 });

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;

    const currentAnime = await prisma.anime.findUnique({
      where: { id },
      select: { title: true, coverImage: true, bannerImage: true, description: true },
    });

    let resolvedDescription = description;
    let resolvedCoverImage = coverImage;
    let resolvedBannerImage = bannerImage;

    if (autoMedia !== false) {
      const missingCover = coverImage === undefined || coverImage === null || String(coverImage).trim() === "";
      const missingBanner = bannerImage === undefined || bannerImage === null || String(bannerImage).trim() === "";
      const missingDescription = description === undefined || description === null || String(description).trim() === "";

      if (missingCover || missingBanner || missingDescription) {
        const titleForMedia = String(title || currentAnime?.title || "").trim();
        if (titleForMedia) {
          const [media] = await searchAnimeMetadataOptions(titleForMedia, 1);
          if (media) {
            if (media.coverImage) {
              if (missingCover && !currentAnime?.coverImage) {
                resolvedCoverImage = media.coverImage;
              }
              if (missingBanner && !currentAnime?.bannerImage) {
                resolvedBannerImage = media.bannerImage || media.coverImage;
              }
            }
            if (missingDescription && !currentAnime?.description && media.description) {
              resolvedDescription = media.description;
            }
          }
        }
      }
    }

    if (
      autoMedia !== false &&
      typeof resolvedDescription === "string" &&
      resolvedDescription.trim()
    ) {
      resolvedDescription = await ensurePortugueseSynopsis(resolvedDescription);
    }

    if (description !== undefined || resolvedDescription !== undefined) {
      data.description =
        typeof resolvedDescription === "string"
          ?resolvedDescription.trim()
          : resolvedDescription;
    }

    const shouldUpdateArtwork =
      coverImage !== undefined ||
      bannerImage !== undefined ||
      resolvedCoverImage !== undefined ||
      resolvedBannerImage !== undefined;
    if (shouldUpdateArtwork) {
      const { coverImage: compatibleCover, bannerImage: compatibleBanner } = resolveArtworkPair(
        resolvedCoverImage ?? currentAnime?.coverImage,
        resolvedBannerImage ?? currentAnime?.bannerImage,
      );
      data.coverImage = compatibleCover || null;
      data.bannerImage = compatibleBanner || null;
    }

    if (status !== undefined) data.status = status;
    if (visibility !== undefined) data.visibility = normalizeVisibility(visibility);
    if (
      body?.externalProvider !== undefined ||
      body?.externalId !== undefined ||
      body?.externalIdType !== undefined ||
      body?.mediaType !== undefined
    ) {
      Object.assign(data, normalizeExternalPlayback(body));
    }

    const anime = await prisma.anime.update({ where: { id }, data });

    revalidateTag("recent-animes-home");
    return NextResponse.json(anime);
  } catch (error) {
    if (error instanceof Error && error.message.includes("ID TMDb")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Anime Update Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });
    const { id } = await req.json();
    await prisma.anime.delete({ where: { id } });

    revalidateTag("recent-animes-home");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Anime Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

    const animes = await prisma.anime.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        coverImage: true,
        bannerImage: true,
        visibility: true,
        status: true,
        externalProvider: true,
        externalId: true,
        externalIdType: true,
        mediaType: true,
      },
    });

    return NextResponse.json(
      animes.map((anime) => ({
        ...anime,
        visibility: toVisibilityForClient(anime.visibility),
      })),
    );
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * Admin anime catalog CRUD endpoint.
 */
