import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { email: session.user.email },
      data: { lastActiveAt: new Date() },
      select: { id: true },
    });
  } catch {
    // Keep endpoint resilient when database schema is temporarily outdated.
  }

  return NextResponse.json({ ok: true });
}
