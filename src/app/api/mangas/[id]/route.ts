import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getNavigationState } from "@/lib/navigation";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [session, navigation] = await Promise.all([
    getServerSession(authOptions),
    getNavigationState(),
  ]);
  const isAdmin = (session?.user as any)?.role === "admin";

  if (!isAdmin && !navigation.mangaTabEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manga = await prisma.manga.findUnique({
    where: { id: params.id },
    include: {
      categories: { select: { id: true, name: true } },
      chapters: {
        orderBy: [{ volumeNumber: "asc" }, { chapterNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!manga) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin && manga.visibility === "admin_only") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(manga);
}
