import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { animeId, title, number, season, videoUrl } = await req.json();

    const episode = await prisma.episode.create({
      data: {
        title: title || `Episódio ${number}`,
        number: parseInt(number),
        season: parseInt(season) || 1,
        videoUrl,
        animeId,
      },
    });

    return NextResponse.json(episode);
  } catch (error) {
    console.error("Episode Creation Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id, title, number, season, videoUrl } = await req.json();
    if (!id) return new NextResponse("ID required", { status: 400 });

    const episode = await prisma.episode.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(number !== undefined && { number: parseInt(number) }),
        ...(season !== undefined && { season: parseInt(season) }),
        ...(videoUrl !== undefined && { videoUrl }),
      },
    });

    return NextResponse.json(episode);
  } catch (error) {
    console.error("Episode Update Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await req.json();
    if (!id) return new NextResponse("ID required", { status: 400 });

    await prisma.episode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Episode Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const animeId = searchParams.get("animeId");
    if (!animeId) return new NextResponse("animeId required", { status: 400 });

    const episodes = await prisma.episode.findMany({
      where: { animeId },
      orderBy: [{ season: "asc" }, { number: "asc" }],
    });

    return NextResponse.json(episodes);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
