import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getNavigationState } from "@/lib/navigation";
import prisma from "@/lib/prisma";

export async function GET() {
  const [session, navigation] = await Promise.all([
    getServerSession(authOptions),
    getNavigationState(),
  ]);
  const isAdmin = (session?.user as any)?.role === "admin";

  if (!isAdmin && !navigation.mangaTabEnabled) {
    return NextResponse.json([]);
  }

  const mangas = await prisma.manga.findMany({
    where: isAdmin ? {} : { visibility: "public" },
    orderBy: { updatedAt: "desc" },
    include: {
      categories: { select: { id: true, name: true } },
      _count: { select: { chapters: true } },
    },
    take: 120,
  });

  return NextResponse.json(mangas);
}
