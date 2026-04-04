import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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
  const isAdmin = (session?.user as any)?.role === "admin";

  return NextResponse.json(
    {
      animeTabEnabled: state.animeTabEnabled,
      mangaTabEnabled: state.mangaTabEnabled,
      isAdmin,
      canAccessAnimeTab: isAdmin || state.animeTabEnabled,
      canAccessMangaTab: isAdmin || state.mangaTabEnabled,
      updatedAt: state.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
