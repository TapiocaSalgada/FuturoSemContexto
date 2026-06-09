import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [openBugReportsCount, pendingSuggestionsCount] = await Promise.all([
      prisma.bugReport.count({ where: { status: "open" } }),
      prisma.suggestion.count({ where: { status: "pending" } }),
    ]);

    return NextResponse.json({
      openBugReportsCount,
      pendingSuggestionsCount,
    });
  } catch {
    return NextResponse.json(
      { openBugReportsCount: 0, pendingSuggestionsCount: 0 },
      { status: 200 },
    );
  }
}
/**
 * Admin alerts endpoint.
 * Returns dashboard alert counters used by the admin overview cards.
 */
