import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserOnline } from "@/lib/presence";
import { isBanActive } from "@/lib/ban";

function cleanUsername(value: unknown) {
  const next = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return next.length >= 3 ? next : null;
}

// Update profile: name, username, bio, avatarUrl, bannerUrl
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, username, bio, avatarUrl, bannerUrl, isPrivate } = await req.json();
  const current = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, banned: true, banReason: true, bannedAt: true, bannedUntil: true },
  });
  if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (isBanActive(current)) return NextResponse.json({ error: "Conta suspensa." }, { status: 403 });

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name || "").slice(0, 80);
  if (username !== undefined) data.username = cleanUsername(username);
  if (bio !== undefined) data.bio = String(bio || "").slice(0, 500);
  if (avatarUrl !== undefined) data.avatarUrl = String(avatarUrl || "").slice(0, 500);
  if (bannerUrl !== undefined) data.bannerUrl = String(bannerUrl || "").slice(0, 500);
  if (isPrivate !== undefined) data.isPrivate = isPrivate;

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data,
    select: { id: true, name: true, username: true, email: true, avatarUrl: true, bannerUrl: true, bio: true },
  });
  return NextResponse.json(user);
}

// GET any public profile by id
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const session = await getServerSession(authOptions);

  const [user, rawHistories] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, avatarUrl: true, bannerUrl: true, bio: true, isPrivate: true,
        lastActiveAt: true,
        settings: { select: { showHistory: true, allowFollow: true } },
        _count: { select: { followers: true, following: true } },
        favorites: {
          include: {
            anime: { select: { id: true, title: true, coverImage: true, visibility: true } },
            folder: { select: { id: true, name: true, isPrivate: true } },
          },
        },
        favoriteFolders: { select: { id: true, name: true, isPrivate: true } },
      },
    }),
    prisma.watchHistory.findMany({
      where: {
        userId: id,
        episode: { anime: { visibility: "public" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        episode: { include: { anime: { select: { id: true, title: true, coverImage: true, visibility: true } } } },
      },
    })
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isOwner = (session?.user as any)?.id === id;

  // If private and not owner, hide favorites/history
  if (user.isPrivate && !isOwner) {
    (user as any).favorites = [];
    (user as any).favoriteFolders = [];
  }

  // Deduplicate and process histories (only if allowed)
  const historiesList: any[] = [];
  const canShowHistory = isOwner || (!user.isPrivate && user.settings?.showHistory !== false);
  
  if (canShowHistory && rawHistories) {
    const seenAnimes = new Set<string>();
    for (const h of rawHistories) {
      const aid = h.episode?.anime?.id;
      const visibility = h.episode?.anime?.visibility;
      if (aid && !seenAnimes.has(aid) && visibility === "public") {
        seenAnimes.add(aid);
        historiesList.push(h);
        if (historiesList.length >= 10) break;
      }
    }
  }

  // Hide admin_only favorites in public profile response
  (user as any).favorites = (user as any).favorites?.filter((f: any) => f?.anime?.visibility === "public") || [];

  return NextResponse.json({
    ...user,
    isOnline: isUserOnline(user.lastActiveAt),
    canFollow: user.settings?.allowFollow !== false,
    histories: historiesList,
  });
}
/**
 * Profile read/update endpoint.
 */
