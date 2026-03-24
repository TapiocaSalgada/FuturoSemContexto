import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function isAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session && (session.user as any).role === "admin";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return new NextResponse("Unauthorized", { status: 401 });
    const { title, description, coverImage, bannerImage, status } = await req.json();

    // Prevent duplicates
    const existing = await prisma.anime.findFirst({ where: { title: { equals: title, mode: "insensitive" } } });
    if (existing) return new NextResponse("Anime já existe no catálogo.", { status: 409 });

    const anime = await prisma.anime.create({ data: { title, description, coverImage, bannerImage, status: status || "ongoing", visibility: "public" } });
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
    const { id, title, description, coverImage, bannerImage, status, visibility } = await req.json();
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (coverImage !== undefined) data.coverImage = coverImage;
    if (bannerImage !== undefined) data.bannerImage = bannerImage;
    if (status !== undefined) data.status = status;
    if (visibility !== undefined) data.visibility = visibility;
    const anime = await prisma.anime.update({ where: { id }, data });
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Anime Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET() {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { id: "desc" },
      include: { episodes: { select: { season: true } } },
    });
    return NextResponse.json(animes);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
