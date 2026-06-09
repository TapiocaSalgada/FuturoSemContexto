import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ accounts: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const account = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    if (!account) return NextResponse.json({ accounts: [] }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({
      accounts: [
        {
        id: account.id,
        name: account.name,
        email: account.email,
        avatarUrl: account.avatarUrl || null,
        role: account.role,
        },
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ accounts: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
/**
 * Saved account/session helper endpoint for login UX.
 */
