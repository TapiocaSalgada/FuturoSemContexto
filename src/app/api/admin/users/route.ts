import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { isUserOnline } from "@/lib/presence";
import { isOwnerEmail, isSiteAdmin } from "@/lib/admin-access";
import { isBanActive } from "@/lib/ban";

function parseLimit(value: string | null) {
  const parsed = Number(value || 80);
  if (!Number.isFinite(parsed)) return 80;
  return Math.max(1, Math.min(200, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const status = String(searchParams.get("status") || "all").trim().toLowerCase();
  const role = String(searchParams.get("role") || "all").trim().toLowerCase();
  const online = String(searchParams.get("online") || "").trim() === "1";
  const limit = parseLimit(searchParams.get("limit"));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0) || 0);

  let usersWithOnline: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isTimedOut: Date | null;
    bio: string | null;
    bannerUrl: string | null;
    banned: boolean;
    banReason: string | null;
    bannedAt: Date | null;
    bannedUntil: Date | null;
    bannedById: string | null;
    lastActiveAt?: Date | null;
    _count: { favorites: number; histories: number };
    onlineNow: boolean;
  }> = [];

  try {
    const users = await prisma.user.findMany({
      where: {
        ...(q
          ?{
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(role !== "all" ?{ role } : {}),
        ...(status === "banned" ?{ banned: true } : {}),
        ...(status === "active" ?{ banned: false } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isTimedOut: true,
        bio: true,
        bannerUrl: true,
        banned: true,
        banReason: true,
        bannedAt: true,
        bannedUntil: true,
        bannedById: true,
        lastActiveAt: true,
        _count: { select: { favorites: true, histories: true } },
      },
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
    });

    usersWithOnline = users.map((user) => ({
      ...user,
      onlineNow: isUserOnline(user.lastActiveAt),
    }));
  } catch {
    const users = await prisma.user.findMany({
      where: {
        ...(q
          ?{
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(role !== "all" ?{ role } : {}),
        ...(status === "banned" ?{ banned: true } : {}),
        ...(status === "active" ?{ banned: false } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isTimedOut: true,
        bio: true,
        bannerUrl: true,
        banned: true,
        banReason: true,
        bannedAt: true,
        bannedUntil: true,
        bannedById: true,
        _count: { select: { favorites: true, histories: true } },
      },
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
    });

    usersWithOnline = users.map((user) => ({
      ...user,
      onlineNow: false,
    }));
  }

  const onlineUsers = usersWithOnline
    .filter((user) => user.onlineNow && !isBanActive(user))
    .map((user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl || null }));

  return NextResponse.json({
    users: usersWithOnline
      .filter((user) => !online || user.onlineNow)
      .map((user) => ({
      ...user,
      banActive: isBanActive(user),
    })),
    onlineCount: onlineUsers.length,
    onlineUsers,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorEmail = session?.user?.email;
  const requestorIsOwner = isOwnerEmail(requestorEmail);
  const { id, name, email, role, timeoutUntil, warningMessage } = await req.json();
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });

  // Only the owner can demote other admins OR edit the owner account
  if (role !== undefined) {
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
    // Block demoting the owner
    if (isOwnerEmail(targetUser?.email) && role !== "admin") {
      return NextResponse.json({ error: "O dono do site não pode ser rebaixado." }, { status: 403 });
    }
    // Block non-owners from demoting other admins
    if (targetUser?.role === "admin" && !requestorIsOwner && role !== "admin") {
      return NextResponse.json({ error: "Apenas o dono pode remover outros admins." }, { status: 403 });
    }
  }

  // Block editing the owner account unless you ARE the owner
  if (email !== undefined) {
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (isOwnerEmail(targetUser?.email) && !requestorIsOwner) {
      return NextResponse.json({ error: "Não é permitido editar a conta do dono." }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (timeoutUntil !== undefined) data.isTimedOut = timeoutUntil ?new Date(timeoutUntil) : null;

  if (warningMessage && typeof warningMessage === "string" && warningMessage.trim()) {
    await createNotification({
      userId: id,
      actorId: null,
      type: "announcement",
      title: "Aviso da moderação",
      body: warningMessage.trim(),
      link: "/configuracoes",
    });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorEmail = session?.user?.email;
  const { id } = await req.json();

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (isOwnerEmail(targetUser?.email)) {
    return NextResponse.json({ error: "Não é permitido deletar a conta do dono." }, { status: 403 });
  }
  if (targetUser?.email === requestorEmail) {
    return NextResponse.json({ error: "Você não pode deletar sua própria conta." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
/**
 * Admin user management endpoint (role changes, moderation actions).
 */

