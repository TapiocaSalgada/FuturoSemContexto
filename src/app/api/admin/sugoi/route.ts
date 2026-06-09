import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  fetchSugoiEpisodeSources,
  searchSugoiDatabaseAnime,
  slugifySugoi,
} from "@/lib/sugoi-provider";
import { resolveKappaEpisodeBySlug, searchProviderWithFallback } from "@/lib/providers/search";

type NormalizedSource = {
  provider: string;
  isEmbed: boolean;
  hasAds: boolean;
  url: string;
  searchedEndpoint: string;
  raw?: any;
};

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreTitleMatch(query: string, title: string) {
  const q = normalizeKey(query);
  const t = normalizeKey(title);
  if (!q || !t) return 0;
  if (q === t) return 100;
  if (t.startsWith(q) || q.startsWith(t)) return 80;
  if (t.includes(q) || q.includes(t)) return 60;

  const qTokens = q.split(" ").filter(Boolean);
  const tTokens = new Set(t.split(" ").filter(Boolean));
  const overlap = qTokens.filter((token) => tTokens.has(token)).length;
  return overlap * 8;
}

function normalizeSearchUrl(url?: string) {
  const value = String(url || "").trim();
  if (!value.startsWith("http")) return "";

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    ["token", "signature", "sig", "expires", "exp", "v", "version"].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.toLowerCase()}`;
  } catch {
    return value.toLowerCase();
  }
}

function rankAndDedupeSearchItems(query: string, items: any[]) {
  const byKey = new Map<string, any>();

  for (const item of items) {
    const slug = slugifySugoi(String(item?.slug || item?.raw?.slug || ""));
    const titleKey = normalizeKey(String(item?.title || ""));
    const urlKey = normalizeSearchUrl(item?.url);
    const key = slug ?`slug:${slug}` : urlKey ?`url:${urlKey}` : `title:${titleKey}`;

    if (!key || key === "title:") continue;

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, item);
      continue;
    }

    const currentScore =
      scoreTitleMatch(query, String(current?.title || "")) +
      (current?.image ?8 : 0) +
      (current?.slug ?4 : 0) +
      (current?.url ?2 : 0);
    const nextScore =
      scoreTitleMatch(query, String(item?.title || "")) +
      (item?.image ?8 : 0) +
      (item?.slug ?4 : 0) +
      (item?.url ?2 : 0);

    if (nextScore > currentScore) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const byTitle =
        scoreTitleMatch(query, String(b?.title || "")) -
        scoreTitleMatch(query, String(a?.title || ""));
      if (byTitle !== 0) return byTitle;
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    })
    .slice(0, 40);
}

function mapKappaFallbackToSugoi(item: any) {
  const fallbackSlug = slugifySugoi(item.raw?.slug || item.title || item.id);
  return {
    id: fallbackSlug || item.id,
    title: item.title,
    image: item.image,
    url: item.url,
    slug: fallbackSlug,
    source: "Sugoi fallback (Kappa)",
    raw: {
      ...item.raw,
      slug: fallbackSlug,
      _fallback: "kappa",
    },
  };
}

async function searchSugoiCatalog(query: string) {
  const rows = await searchSugoiDatabaseAnime(query, 40);
  let merged = rows.map((item) => {
    const slug = slugifySugoi(item.title || "");
    return {
      id: String(item.malId || item.id || slug || item.title),
      title: item.title,
      image: item.coverImage || item.bannerImage || "",
      url: item.malId ?`https://myanimelist.net/anime/${item.malId}` : "",
      slug,
      source: "Sugoi Database",
      raw: {
        ...(item.raw || {}),
        slug,
        synopsis: item.synopsis,
        banner: item.bannerImage,
        cover: item.coverImage,
      },
    };
  });

  if (merged.length < 14) {
    const fallback = await searchProviderWithFallback("kappa", query);
    merged = [...merged, ...fallback.map(mapKappaFallbackToSugoi)];
  }

  return rankAndDedupeSearchItems(query, merged);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const slug = searchParams.get("slug")?.trim();
  const season = searchParams.get("season")?.trim() || "1";
  const episode = searchParams.get("episode")?.trim();

  if (query && !episode) {
    try {
      const results = await searchSugoiCatalog(query);
      return NextResponse.json(results);
    } catch {
      return NextResponse.json({ error: "Falha ao pesquisar na Sugoi." }, { status: 500 });
    }
  }

  if (!slug || !episode) {
    return NextResponse.json({ error: "slug e episode são obrigatórios" }, { status: 400 });
  }

  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json({ error: "episode deve ser um número >= 1" }, { status: 400 });
  }

  try {
    const sources = await fetchSugoiEpisodeSources(
      slug,
      Number.isFinite(seasonNumber) && seasonNumber > 0 ?seasonNumber : 1,
      episodeNumber,
    );

    if (sources.length > 0) {
      const normalizedSources: NormalizedSource[] = sources.map((source) => ({
        provider: source.provider || "sugoi",
        isEmbed: Boolean(source.isEmbed),
        hasAds: false,
        url: source.url,
        searchedEndpoint: "",
        raw: source.raw,
      }));

      return NextResponse.json({
        slug,
        season,
        episode,
        sources: normalizedSources,
        primaryUrl: normalizedSources[0]?.url,
        provider: "sugoi",
      });
    }

    const kappaFallback = await resolveKappaEpisodeBySlug(slugifySugoi(slug), episodeNumber);
    if (kappaFallback?.videoUrl) {
      return NextResponse.json({
        slug,
        season,
        episode,
        sources: [
          {
            provider: "kappa-fallback",
            isEmbed: false,
            hasAds: false,
            url: kappaFallback.videoUrl,
            searchedEndpoint: "kappa/episode-video",
          },
        ],
        primaryUrl: kappaFallback.videoUrl,
        provider: "kappa-fallback",
        anime: {
          id: kappaFallback.anime.id,
          title: kappaFallback.anime.title,
          episodeId: kappaFallback.episode.id,
          episodeNumber: kappaFallback.episode.number,
        },
      });
    }

    return NextResponse.json(
      { error: "Nenhuma fonte encontrada na Sugoi e fallback Kappa falhou." },
      { status: 404 },
    );
  } catch (error) {
    console.error("Sugoi proxy error", error);
    return NextResponse.json({ error: "Erro interno no proxy Sugoi" }, { status: 500 });
  }
}
