import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Proxy for SugoiAPI: /api/admin/sugoi?slug=naruto&season=1&episode=1
// Returns a normalized list of sources.

const DEFAULT_BASE = "https://sugoiapi.vercel.app";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim();
  const season = searchParams.get("season")?.trim() || "1";
  const episode = searchParams.get("episode")?.trim();

  if (!slug || !episode) {
    return NextResponse.json({ error: "slug e episode são obrigatórios" }, { status: 400 });
  }

  const baseUrl = process.env.SUGOI_API_BASE?.trim() || DEFAULT_BASE;
  const url = `${baseUrl.replace(/\/$/, "")}/episode/${encodeURIComponent(slug)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json({ error: `Sugoi respondeu ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    if (data?.error) {
      return NextResponse.json({ error: data.message || "Não encontrado" }, { status: 404 });
    }

    const providers = Array.isArray(data?.data) ? data.data : [];
    const sources = providers.flatMap((provider: any) => {
      const eps = Array.isArray(provider?.episodes) ? provider.episodes : [];
      return eps
        .filter((ep: any) => ep && ep.episode)
        .map((ep: any) => ({
          provider: provider.name || provider.slug || "desconhecido",
          isEmbed: !!provider.is_embed,
          hasAds: !!provider.has_ads,
          url: ep.episode,
          searchedEndpoint: ep.searched_endpoint,
        }));
    });

    if (!sources.length) {
      return NextResponse.json({ error: "Nenhuma fonte retornada" }, { status: 404 });
    }

    return NextResponse.json({
      slug,
      season,
      episode,
      sources,
      primaryUrl: sources[0]?.url,
    });
  } catch (error) {
    console.error("Sugoi proxy error", error);
    return NextResponse.json({ error: "Erro interno no proxy Sugoi" }, { status: 500 });
  }
}
