import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { searchProviderWithFallback } from "@/lib/providers/search";

type SourceItem = {
  id: string;
  title: string;
  image?: string;
  url?: string;
  slug?: string;
  source: string;
  raw?: any;
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseAnimeSlug(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const idx = segments.findIndex((segment) => segment.toLowerCase() === "animes");
      if (idx >= 0 && segments[idx + 1]) {
        return slugify(segments[idx + 1]);
      }
      return slugify(segments[segments.length - 1] || "");
    } catch {
      return "";
    }
  }

  return slugify(raw);
}

async function fetchJson(url: string, timeoutMs = 12000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const text = (await response.text())?.trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function extractList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.dados,
    payload?.results,
    payload?.animes,
    payload?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function dedupe(items: SourceItem[]) {
  const seen = new Set<string>();
  const output: SourceItem[] = [];

  for (const item of items) {
    const key = `${String(item.slug || "").toLowerCase()}|${String(item.id || "").toLowerCase()}|${String(item.title || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function normalizeScraperSearch(payload: any): SourceItem[] {
  const list = extractList(payload);
  return dedupe(
    list
      .map((item: any, index: number) => {
        const title = String(item?.title || item?.name || item?.nome || "").trim();
        if (!title) return null;

        const url = String(item?.url || item?.link || "").trim();
        const slug = parseAnimeSlug(item?.slug || item?.anime_slug || url || title);
        return {
          id: String(item?.id || slug || `anfire-scraper-${index}`),
          title,
          image: item?.img || item?.image || item?.cover || item?.anime_image || "",
          url,
          slug,
          source: "AnimeFire Scraper",
          raw: {
            ...item,
            ...(slug ? { slug } : {}),
            _origin: "anfire-scraper",
          },
        } as SourceItem;
      })
      .filter(Boolean) as SourceItem[],
  );
}

async function searchWithAnimeFireScraper(query: string) {
  const q = encodeURIComponent(query);
  const bases = [
    process.env.ANFIRE_SCRAPER_API_BASE?.trim(),
    "https://web-scraper-anime.vercel.app",
    "https://web-scraper-anime-production.up.railway.app",
  ]
    .filter((base): base is string => Boolean(base))
    .map((base) => base.replace(/\/+$/, ""));

  const paths = [
    `/anime/search?q=${q}`,
    `/api/anime/search?q=${q}`,
    `/anime/search?keyword=${q}`,
    `/search?q=${q}`,
  ];

  for (const base of bases) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      if (!payload) continue;
      const normalized = normalizeScraperSearch(payload);
      if (normalized.length > 0) return normalized;
    }
  }

  return [] as SourceItem[];
}

async function fetchWithAnfirePlayer(params: { animeSlug?: string; animeLink?: string }) {
  const apiBase = process.env.ANFIRE_API_BASE?.trim();
  const apiKey = process.env.ANFIRE_API_KEY?.trim();
  if (!apiBase || !apiKey) return [] as SourceItem[];

  const animeLink = String(params.animeLink || "").trim();
  const animeSlug = parseAnimeSlug(String(params.animeSlug || "").trim());
  if (!animeLink && !animeSlug) return [] as SourceItem[];

  const base = apiBase.replace(/\/+$/, "");
  const rawQuery = animeLink
    ? `api_key=${encodeURIComponent(apiKey)}&anime_link=${encodeURIComponent(animeLink)}&update=true`
    : `api_key=${encodeURIComponent(apiKey)}&anime_slug=${encodeURIComponent(animeSlug)}&update=true`;

  const paths = [`/api.php?${rawQuery}`, `/?${rawQuery}`];

  let payload: any = null;
  for (const path of paths) {
    payload = await fetchJson(`${base}${path}`, 15000);
    if (payload?.anime_title || payload?.anime_slug) break;
  }

  const title = String(payload?.anime_title || payload?.title || "").trim();
  if (!title) return [] as SourceItem[];

  const detectedSlug = parseAnimeSlug(payload?.anime_slug || animeSlug || animeLink || title);
  const url = String(payload?.anime_link || animeLink || (detectedSlug ? `https://animefire.plus/animes/${detectedSlug}` : "")).trim();

  return [
    {
      id: detectedSlug || slugify(title) || "anfire-player",
      title,
      image: String(payload?.anime_image || payload?.image || "").trim(),
      url,
      slug: detectedSlug,
      source: "AnFireAPI Player",
      raw: {
        ...(payload || {}),
        ...(detectedSlug ? { slug: detectedSlug } : {}),
        _origin: "anfire-player",
      },
    },
  ];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = String(searchParams.get("mode") || "").trim().toLowerCase();
  const q = searchParams.get("q")?.trim() || searchParams.get("keyword")?.trim() || "";
  const animeSlug = searchParams.get("anime_slug")?.trim() || searchParams.get("slug")?.trim() || "";
  const animeLink = searchParams.get("anime_link")?.trim() || searchParams.get("link")?.trim() || "";

  if (mode === "player" || animeSlug || animeLink) {
    if (!animeSlug && !animeLink) {
      return NextResponse.json(
        {
          error: "Modo player exige anime_slug ou anime_link.",
          rule: "GET /api/admin/anfire?mode=player&anime_slug=<slug>",
        },
        { status: 400 },
      );
    }

    const items = await fetchWithAnfirePlayer({ animeSlug, animeLink });
    if (!items.length) {
      return NextResponse.json(
        {
          error: "Nenhum resultado encontrado no modo player.",
          rule: "Confirme anime_slug/anime_link e variaveis ANFIRE_API_BASE/ANFIRE_API_KEY.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(items);
  }

  if (mode === "scraper") {
    if (!q) {
      return NextResponse.json(
        {
          error: "Modo scraper exige q.",
          rule: "GET /api/admin/anfire?mode=scraper&q=<texto>",
        },
        { status: 400 },
      );
    }

    const items = await searchWithAnimeFireScraper(q);
    return NextResponse.json(items);
  }

  if (!q) {
    return NextResponse.json(
      {
        error: "Informe q para busca scraper ou use mode=player com anime_slug/anime_link.",
        rule: "GET /api/admin/anfire?mode=scraper&q=<texto>",
      },
      { status: 400 },
    );
  }

  const scraperResults = await searchWithAnimeFireScraper(q);
  if (scraperResults.length > 0) {
    return NextResponse.json(scraperResults);
  }

  const results = await searchProviderWithFallback("anfire", q, { allowKappaFallback: false });
  return NextResponse.json(results);
}
/**
 * Admin provider route: Anfire lookup/proxy integration.
 */
