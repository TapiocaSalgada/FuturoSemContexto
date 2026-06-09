import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import { getNavigationState } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const [state, session] = await Promise.all([
    getNavigationState().catch(() => ({
      animeTabEnabled: true,
      mangaTabEnabled: false,
      updatedAt: null,
    })),
    getServerSession(authOptions),
  ]);
  const isAdmin = isSiteAdmin(session as any);

  return NextResponse.json(
    {
      animeTabEnabled: state.animeTabEnabled,
      mangaTabEnabled: false,
      isAdmin,
      canAccessAnimeTab: isAdmin || state.animeTabEnabled,
      canAccessMangaTab: false,
      updatedAt: state.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
/**
 * Public runtime navigation-state reader endpoint.
 */
