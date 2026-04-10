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
  const limit = Math.max(1, Math.min(12, Number(req.nextUrl.searchParams.get("limit") || 8)));
  if (query.length < 2) {
    return NextResponse.json({ error: "Query obrigatoria (minimo 2 caracteres)." }, { status: 400 });
  }

  try {
    const options = await searchAnimeMetadataOptions(query, limit);
    if (!options.length) {
      return NextResponse.json({ ok: true, found: false, media: null, options: [] });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      media: options[0],
      options,
    });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar midia para o anime." }, { status: 500 });
  }
}
/**
 * Admin endpoint for anime media assets (cover/banner/source metadata).
 */
