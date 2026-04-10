import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: [{ role: "desc" }, { name: "asc" }],
      take: 20,
    });

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        avatarUrl: account.avatarUrl || null,
        role: account.role,
      })),
    });
  } catch {
    return NextResponse.json({ accounts: [] });
  }
}
/**
 * Saved account/session helper endpoint for login UX.
 */
