import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

  const mangas = await prisma.manga.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      chapters: { select: { id: true } },
      categories: { select: { id: true, name: true, slug: true } },
    },
  });
  return NextResponse.json(mangas);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const title = String(body?.title || "").trim();

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio." }, { status: 400 });
  }

  const existing = await prisma.manga.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Manga ja existe no catalogo.", existingId: existing.id }, { status: 409 });
  }

  const categoryIds = await resolveCategoryIds(Array.isArray(body?.categoryNames) ? body.categoryNames : []);

  const manga = await prisma.manga.create({
    data: {
      title,
      description: typeof body?.description === "string" ? body.description : null,
      coverImage: typeof body?.coverImage === "string" ? body.coverImage : null,
      bannerImage: typeof body?.bannerImage === "string" ? body.bannerImage : null,
      malId: Number.isFinite(Number(body?.malId)) ? Number(body.malId) : null,
      malUrl: typeof body?.malUrl === "string" ? body.malUrl : null,
      status: typeof body?.status === "string" ? body.status : "ongoing",
      visibility: typeof body?.visibility === "string" ? body.visibility : "public",
      source: typeof body?.source === "string" ? body.source : null,
      sourceId: typeof body?.sourceId === "string" ? body.sourceId : null,
      sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : null,
      language: typeof body?.language === "string" ? body.language : null,
      ...(categoryIds.length > 0
        ? {
            categories: {
              connect: categoryIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
  });

  return NextResponse.json(manga);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body?.title !== undefined) data.title = body.title;
  if (body?.description !== undefined) data.description = body.description;
  if (body?.coverImage !== undefined) data.coverImage = body.coverImage;
  if (body?.bannerImage !== undefined) data.bannerImage = body.bannerImage;
  if (body?.malId !== undefined) data.malId = Number.isFinite(Number(body.malId)) ? Number(body.malId) : null;
  if (body?.malUrl !== undefined) data.malUrl = body.malUrl;
  if (body?.status !== undefined) data.status = body.status;
  if (body?.visibility !== undefined) data.visibility = body.visibility;
  if (body?.source !== undefined) data.source = body.source;
  if (body?.sourceId !== undefined) data.sourceId = body.sourceId;
  if (body?.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl;
  if (body?.language !== undefined) data.language = body.language;

  if (body?.categoryNames !== undefined) {
    const categoryIds = await resolveCategoryIds(Array.isArray(body.categoryNames) ? body.categoryNames : []);
    data.categories = {
      set: categoryIds.map((categoryId) => ({ id: categoryId })),
    };
  }

  const manga = await prisma.manga.update({ where: { id }, data });
  return NextResponse.json(manga);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });

  await prisma.manga.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
