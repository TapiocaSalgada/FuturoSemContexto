import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Update profile: name, bio, avatarUrl, bannerUrl
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, bio, avatarUrl, bannerUrl, isPrivate } = await req.json();
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (bio !== undefined) data.bio = bio;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
  if (bannerUrl !== undefined) data.bannerUrl = bannerUrl;
  if (isPrivate !== undefined) data.isPrivate = isPrivate;

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data,
    select: { id: true, name: true, email: true, avatarUrl: true, bannerUrl: true, bio: true },
  });
  return NextResponse.json(user);
}

// GET any public profile by id
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.email && (await prisma.user.findUnique({ where: { email: session.user.email } }))?.id === id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, avatarUrl: true, bannerUrl: true, bio: true, ...({ isPrivate: true } as any),
      _count: { select: { followers: true, following: true } },
      favorites: {
        include: {
          anime: { select: { id: true, title: true, coverImage: true } },
          folder: { select: { id: true, name: true, isPrivate: true } },
        },
      },
      favoriteFolders: { select: { id: true, name: true, isPrivate: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If private and not owner, hide favorites
  if ((user as any).isPrivate && !isOwner) {
    (user as any).favorites = [];
    (user as any).favoriteFolders = [];
  }

  // Fetch histories manually to deduplicate by anime
  let historiesList: any[] = [];
  if (!(user as any).isPrivate || isOwner) {
    const rawHistories = await prisma.watchHistory.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      include: {
        episode: { include: { anime: { select: { id: true, title: true, coverImage: true } } } },
      },
    });

    const seenAnimes = new Set<string>();
    for (const h of rawHistories) {
      const aid = h.episode?.anime?.id;
      if (aid && !seenAnimes.has(aid)) {
        seenAnimes.add(aid);
        historiesList.push(h);
        if (historiesList.length >= 10) break;
      }
    }
  }

  return NextResponse.json({ ...user, histories: historiesList });
}
