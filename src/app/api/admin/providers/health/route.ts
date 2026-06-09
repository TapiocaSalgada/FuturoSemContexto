import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type ProviderProbe = {
  id: string;
  label: string;
  urls: string[];
};

const providers: ProviderProbe[] = [
  { id: "kappa", label: "Kappa API", urls: [process.env.KAPPA_API_BASE || "https://anime-api-kappa-one.vercel.app/api"] },
  { id: "sugoi", label: "Sugoi API", urls: [process.env.SUGOI_API_BASE || "https://sugoi-api-chi.vercel.app"] },
  { id: "anisbr", label: "AnimesBrasil", urls: [process.env.ANIMESBR_API_BASE || "https://api-anime-free.vercel.app/api"] },
  { id: "anfire", label: "AnFireAPI", urls: [process.env.ANFIRE_API_BASE || "https://anfireapi.vercel.app"] },
  { id: "animefenix", label: "AnimeFenix", urls: [process.env.ANIMEFENIX_API_BASE || "https://animefenix-api.vercel.app"] },
  { id: "playanimes", label: "PlayAnimes", urls: [process.env.PLAYANIMES_API_BASE || "https://api-playanimes.vercel.app"] },
  { id: "embedmovies", label: "EmbedMovies", urls: ["https://embedmovies.me"] },
];

async function probe(provider: ProviderProbe) {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  for (const base of provider.urls) {
    const url = String(base || "").replace(/\/+$/, "");
    if (!url) continue;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json,text/plain,text/html,*/*" },
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - started;
      if (response.ok || response.status < 500) {
        return {
          id: provider.id,
          label: provider.label,
          status: "online" as const,
          latencyMs,
          message: `${response.status} em ${url}`,
          checkedAt,
        };
      }
    } catch {
      // Try the next configured base.
    }
  }

  return {
    id: provider.id,
    label: provider.label,
    status: "offline" as const,
    latencyMs: null,
    message: "Sem resposta nos endpoints configurados.",
    checkedAt,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await Promise.all(providers.map(probe));
  return NextResponse.json({ providers: results });
}
