import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function isExpoPushToken(token: string) {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

async function resolveCurrentUserId(email?: string | null) {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id || null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveCurrentUserId(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();
  const platform = String(body?.platform || "").trim() || null;
  const deviceName = String(body?.deviceName || "").trim() || null;

  if (!token || !isExpoPushToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  await prisma.mobilePushToken.upsert({
    where: { token },
    create: {
      token,
      userId,
      platform,
      deviceName,
      isActive: true,
      lastUsedAt: new Date(),
    },
    update: {
      userId,
      platform,
      deviceName,
      isActive: true,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveCurrentUserId(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();

  if (token) {
    await prisma.mobilePushToken.updateMany({
      where: {
        token,
        userId,
      },
      data: {
        isActive: false,
      },
    });
  } else {
    await prisma.mobilePushToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ ok: true });
}
