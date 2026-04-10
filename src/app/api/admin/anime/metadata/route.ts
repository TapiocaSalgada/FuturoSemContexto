import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { searchAnimeMetadataOptions } from "@/lib/anime-metadata";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error nextauth custom role
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = String(req.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit") || 12)));

  if (query.length < 2) {
    return NextResponse.json({ error: "Query obrigatoria (minimo 2 caracteres)." }, { status: 400 });
  }

  try {
    const options = await searchAnimeMetadataOptions(query, limit);

    return NextResponse.json({
      ok: true,
      found: options.length > 0,
      media: options[0] || null,
      options,
    });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar metadados do anime." }, { status: 500 });
  }
}
/**
 * Admin metadata fetch endpoint (MAL + fallback metadata providers).
 */
