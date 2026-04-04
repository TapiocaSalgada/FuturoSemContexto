import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revalidateTag } from "next/cache";
import { findMalMetadataByTitle } from "@/lib/mal";

function isAdmin(session: any) {
  return session?.user?.role === "admin";
}

function slugifyCategory(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeVisibility(value: unknown): "public" | "admin_only" {
  const current = String(value || "").trim().toLowerCase();
  if (current === "public") return "public";
  if (current === "admin_only" || current === "private") return "admin_only";
  return "public";
}

function toVisibilityForClient(value: unknown): "public" | "admin_only" {
  return String(value || "").trim().toLowerCase() === "public" ? "public" : "admin_only";
}

async function resolveCategoryIds(categoryNames: string[]) {
  const uniqueNames = Array.from(
    new Set(categoryNames.map((name) => name.trim()).filter(Boolean)),
  );
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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });
    const body = await req.json();
    const {
      title,
      description,
      coverImage,
      bannerImage,
      status,
      visibility,
      categoryNames,
      autoMedia,
    } = body || {};
    if (!title) return new NextResponse("Título obrigatório.", { status: 400 });

    // Prevent duplicates
    const existing = await prisma.anime.findFirst({ where: { title: { equals: title, mode: "insensitive" } } });
    if (existing) {
      return NextResponse.json(
        { error: "Anime já existe no catálogo.", existingId: existing.id },
        { status: 409 },
      );
    }

    let resolvedCategoryNames = Array.isArray(categoryNames)
      ? categoryNames.map((name) => String(name).trim()).filter(Boolean)
      : [];
    let resolvedDescription = typeof description === "string" ? description.trim() : "";
    let resolvedCoverImage = typeof coverImage === "string" ? coverImage.trim() : "";
    let resolvedBannerImage = typeof bannerImage === "string" ? bannerImage.trim() : "";

    if (autoMedia !== false && (!resolvedCoverImage || !resolvedBannerImage || !resolvedDescription || resolvedCategoryNames.length === 0)) {
      const media = await findMalMetadataByTitle(String(title));
      if (media) {
        if (media.imageUrl) {
          if (!resolvedCoverImage) {
            resolvedCoverImage = media.imageUrl;
          }
          if (!resolvedBannerImage) {
            resolvedBannerImage = media.imageUrl;
          }
        }
        if (!resolvedDescription && media.synopsis) {
          resolvedDescription = media.synopsis.trim();
        }
        if (resolvedCategoryNames.length === 0) {
          resolvedCategoryNames = Array.from(
            new Set([
              ...(media.genres || []),
              ...(media.themes || []),
              ...(media.demographics || []),
            ].map((name) => String(name).trim()).filter(Boolean)),
          );
        }
      }
    }

    const categoryIds = await resolveCategoryIds(resolvedCategoryNames);

    const anime = await prisma.anime.create({ 
      data: {
        title,
        description: resolvedDescription || null,
        coverImage: resolvedCoverImage || null,
        bannerImage: resolvedBannerImage || null,
        status: status || "ongoing",
        visibility: normalizeVisibility(visibility),
        ...(categoryIds.length > 0
          ? {
              categories: {
                connect: categoryIds.map((id) => ({ id })),
              },
            }
          : {}),
      } 
    });
    
    // Invalidate Home Page Cache
    revalidateTag("recent-animes-home");

    return NextResponse.json(anime);
  } catch (error) {
    console.error("Anime Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });
    const body = await req.json();
    const { id, title, description, coverImage, bannerImage, status, visibility, categoryNames, autoMedia } = body || {};
    if (!id) return new NextResponse("ID obrigatório.", { status: 400 });
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;

    let resolvedDescription = description;
    let resolvedCategoryNames = categoryNames;
    let resolvedCoverImage = coverImage;
    let resolvedBannerImage = bannerImage;

    if (autoMedia !== false) {
      const missingCover = coverImage === undefined || coverImage === null || String(coverImage).trim() === "";
      const missingBanner = bannerImage === undefined || bannerImage === null || String(bannerImage).trim() === "";
      const missingDescription = description === undefined || description === null || String(description).trim() === "";
      const parsedCategoryNames = Array.isArray(categoryNames)
        ? categoryNames.map((name) => String(name).trim()).filter(Boolean)
        : [];
      const missingCategories = categoryNames !== undefined && parsedCategoryNames.length === 0;

      if (missingCover || missingBanner || missingDescription || missingCategories) {
        const currentAnime = await prisma.anime.findUnique({
          where: { id },
          select: {
            title: true,
            coverImage: true,
            bannerImage: true,
            description: true,
          },
        });

        const titleForMedia = String(title || currentAnime?.title || "").trim();
        if (titleForMedia) {
          const media = await findMalMetadataByTitle(titleForMedia);
          if (media) {
            if (media.imageUrl) {
              if (missingCover && !currentAnime?.coverImage) {
                resolvedCoverImage = media.imageUrl;
              }
              if (missingBanner && !currentAnime?.bannerImage) {
                resolvedBannerImage = media.imageUrl;
              }
            }
            if (missingDescription && !currentAnime?.description && media.synopsis) {
              resolvedDescription = media.synopsis;
            }
            if (missingCategories) {
              const generatedCategories = Array.from(
                new Set([
                  ...(media.genres || []),
                  ...(media.themes || []),
                  ...(media.demographics || []),
                ].map((name) => String(name).trim()).filter(Boolean)),
              );
              if (generatedCategories.length > 0) {
                resolvedCategoryNames = generatedCategories;
              }
            }
          }
        }
      }
    }

    if (description !== undefined || resolvedDescription !== undefined) {
      data.description =
        typeof resolvedDescription === "string"
          ? resolvedDescription.trim()
          : resolvedDescription;
    }
    if (coverImage !== undefined || resolvedCoverImage !== undefined) data.coverImage = resolvedCoverImage;
    if (bannerImage !== undefined || resolvedBannerImage !== undefined) data.bannerImage = resolvedBannerImage;
    if (status !== undefined) data.status = status;
    if (visibility !== undefined) data.visibility = normalizeVisibility(visibility);
    if (categoryNames !== undefined || resolvedCategoryNames !== undefined) {
      const categoryIds = await resolveCategoryIds(
        Array.isArray(resolvedCategoryNames)
          ? resolvedCategoryNames.map((name) => String(name).trim()).filter(Boolean)
          : [],
      );
      data.categories = {
        set: categoryIds.map((categoryId) => ({ id: categoryId })),
      };
    }
    const anime = await prisma.anime.update({ where: { id }, data });
    
    // Invalidate Cache
    revalidateTag("recent-animes-home");

    return NextResponse.json(anime);
  } catch (error) {
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
    
    // Invalidate Cache
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
        categories: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json(
      animes.map((anime) => ({
        ...anime,
        visibility: toVisibilityForClient(anime.visibility),
      })),
    );
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
