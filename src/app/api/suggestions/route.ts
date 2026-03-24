import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET suggestions (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const suggestions = await prisma.suggestion.findMany({
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(suggestions);
}

// POST a suggestion (any user)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.isTimedOut && new Date(user.isTimedOut) > new Date()) {
    return NextResponse.json({ error: "You are timed out" }, { status: 403 });
  }

  const { title, description } = await req.json();
  const suggestion = await prisma.suggestion.create({
    data: { userId: user.id, title, description },
  });
  return NextResponse.json(suggestion);
}

// PATCH to update suggestion status (admin only)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role typing
  if (!session || session.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json();
  const suggestion = await prisma.suggestion.update({ where: { id }, data: { status } });
  return NextResponse.json(suggestion);
}
