import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { isUserOnline } from "@/lib/presence";

const OWNER_EMAIL = process.env.OWNER_EMAIL || "relugocruz@gmail.com";

export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let usersWithOnline: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isTimedOut: Date | null;
    bio: string | null;
    bannerUrl: string | null;
    lastActiveAt?: Date | null;
    _count: { favorites: number; histories: number };
    onlineNow: boolean;
  }> = [];

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isTimedOut: true,
        bio: true,
        bannerUrl: true,
        lastActiveAt: true,
        _count: { select: { favorites: true, histories: true } },
      },
      orderBy: { name: "asc" },
    });

    usersWithOnline = users.map((user) => ({
      ...user,
      onlineNow: isUserOnline(user.lastActiveAt),
    }));
  } catch {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isTimedOut: true,
        bio: true,
        bannerUrl: true,
        _count: { select: { favorites: true, histories: true } },
      },
      orderBy: { name: "asc" },
    });

    usersWithOnline = users.map((user) => ({
      ...user,
      onlineNow: false,
    }));
  }

  const onlineUsers = usersWithOnline
    .filter((user) => user.onlineNow)
    .map((user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl || null }));

  return NextResponse.json({
    users: usersWithOnline,
    onlineCount: onlineUsers.length,
    onlineUsers,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorEmail = session.user?.email;
  const { id, name, email, role, timeoutUntil, warningMessage } = await req.json();
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });

  // Only the owner can demote other admins OR edit the owner account
  if (role !== undefined) {
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
    // Block demoting the owner
    if (targetUser?.email === OWNER_EMAIL && role !== "admin") {
      return NextResponse.json({ error: "O dono do site não pode ser rebaixado." }, { status: 403 });
    }
    // Block non-owners from demoting other admins
    if (targetUser?.role === "admin" && requestorEmail !== OWNER_EMAIL && role !== "admin") {
      return NextResponse.json({ error: "Apenas o dono pode remover outros admins." }, { status: 403 });
    }
  }

  // Block editing the owner account unless you ARE the owner
  if (email !== undefined) {
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (targetUser?.email === OWNER_EMAIL && requestorEmail !== OWNER_EMAIL) {
      return NextResponse.json({ error: "Não é permitido editar a conta do dono." }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (timeoutUntil !== undefined) data.isTimedOut = timeoutUntil ? new Date(timeoutUntil) : null;

  if (warningMessage && typeof warningMessage === "string" && warningMessage.trim()) {
    await createNotification({
      userId: id,
      actorId: null,
      type: "announcement",
      title: "Aviso da moderacao",
      body: warningMessage.trim(),
      link: "/settings",
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
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorEmail = session.user?.email;
  const { id } = await req.json();

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (targetUser?.email === OWNER_EMAIL) {
    return NextResponse.json({ error: "Não é permitido deletar a conta do dono." }, { status: 403 });
  }
  if (targetUser?.email === requestorEmail) {
    return NextResponse.json({ error: "Você não pode deletar sua própria conta." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
