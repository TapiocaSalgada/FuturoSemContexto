import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET all users (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, avatarUrl: true,
      isTimedOut: true, bio: true, bannerUrl: true,
      _count: { select: { favorites: true, histories: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

// PATCH update a user (admin only) - edit name, email, role, timeout
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorId = (session.user as any)?.id;
  const { id, name, email, role, timeoutUntil } = await req.json();

  // Prevent non-owner from promoting/demoting admins (only the first admin can manage roles)
  if (role !== undefined && id !== requestorId) {
    // Find the original first admin (oldest by creation time)
    const firstAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { id: "asc" }, // UUID is random, but this at least prevents self-demotion loops
    });
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    // If target is admin and requestor is NOT the first admin, block role change
    if (targetUser?.role === "admin" && firstAdmin?.id !== requestorId) {
      return NextResponse.json({ error: "Apenas o owner pode alterar admins." }, { status: 403 });
    }
    // Never allow self-demotion via admin panel
    if (id === requestorId && role !== "admin") {
      return NextResponse.json({ error: "Você não pode rebaixar a si mesmo." }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (timeoutUntil !== undefined) data.isTimedOut = timeoutUntil ? new Date(timeoutUntil) : null;

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json(user);
}

// DELETE user (admin only)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestorId = (session.user as any)?.id;
  const { id } = await req.json();

  if (id === requestorId) return NextResponse.json({ error: "Você não pode deletar a si mesmo." }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
