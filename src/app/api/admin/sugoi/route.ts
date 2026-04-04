import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveKappaEpisodeBySlug, searchProviderWithFallback } from "@/lib/providers/search";

// Proxy for SugoiAPI: /api/admin/sugoi?slug=naruto&season=1&episode=1
// Returns a normalized list of sources and falls back to Kappa when needed.

const DEFAULT_BASES = ["https://sugoiapi.vercel.app", "https://sugoi-api.vercel.app"];

type NormalizedSource = {
  provider: string;
  isEmbed: boolean;
  hasAds: boolean;
  url: string;
  searchedEndpoint: string;
  raw?: any;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

function extractSlugFromUrl(input?: string | null) {
  if (!input || typeof input !== "string") return "";

  try {
    const parsed = new URL(input);
    const ignored = new Set(["anime", "animes", "title", "titles", "search", "api"]);
    const segments = parsed.pathname
      .split("/")
      .map((part) => slugify(part))
      .filter(Boolean);

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const part = segments[index];
      if (ignored.has(part)) continue;
      if (/^\d+$/.test(part)) continue;
      if (/[a-z]/.test(part)) return part;
    }
  } catch {
    return "";
  }

  return "";
}

function resolveSlugHint(item: any, fallbackTitle: string) {
  const directCandidates = [
    item?.slug,
    item?.anime_slug,
    item?.animeSlug,
    item?.identifier,
    item?.id,
  ];

  for (const candidate of directCandidates) {
    const normalized = slugify(String(candidate || ""));
    if (!normalized || /^\d+$/.test(normalized)) continue;
    if (/[a-z]/.test(normalized)) return normalized;
  }

  const urlSlug =
    extractSlugFromUrl(item?.url) ||
    extractSlugFromUrl(item?.link) ||
    extractSlugFromUrl(item?.source);
  if (urlSlug) return urlSlug;

  const byTitle = slugify(fallbackTitle || "");
  if (byTitle && /[a-z]/.test(byTitle)) return byTitle;

  return "";
}

function compact<T>(items: (T | null | undefined | false)[]) {
  return items.filter(Boolean) as T[];
}

function ensureBase(url: string) {
  return url.replace(/\/+$/, "");
}

function getBases() {
  const envBase = process.env.SUGOI_API_BASE?.trim();
  return compact([envBase, ...DEFAULT_BASES]).map(ensureBase);
}

function extractList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [payload?.data, payload?.results, payload?.providers, payload?.sources, payload?.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractUrlFromItem(item: any) {
  const candidates = [
    typeof item === "string" ? item : "",
    item?.episode,
    item?.url,
    item?.link,
    item?.file,
    item?.video,
    item?.video_url,
    item?.videoUrl,
    item?.src,
    item?.source,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("http")) {
      return candidate;
    }
  }

  return "";
}

function normalizeSources(payload: any): NormalizedSource[] {
  const providers = extractList(payload);
  const output: NormalizedSource[] = [];

  const pushSource = (source: NormalizedSource) => {
    if (!source.url) return;
    output.push(source);
  };

  for (const provider of providers) {
    const providerName = provider?.name || provider?.slug || provider?.provider || "desconhecido";
    const episodes = extractList(provider?.episodes) || provider?.episodes;

    if (Array.isArray(episodes)) {
      for (const ep of episodes) {
        const url = extractUrlFromItem(ep);
        pushSource({
          provider: providerName,
          isEmbed: !!provider?.is_embed,
          hasAds: !!provider?.has_ads,
          url,
          searchedEndpoint: ep?.searched_endpoint || ep?.endpoint || "",
          raw: ep,
        });
      }
    }

    const directUrl = extractUrlFromItem(provider);
    if (directUrl) {
      pushSource({
        provider: providerName,
        isEmbed: !!provider?.is_embed,
        hasAds: !!provider?.has_ads,
        url: directUrl,
        searchedEndpoint: provider?.searched_endpoint || provider?.endpoint || "",
        raw: provider,
      });
    }
  }

  const topLevelUrl = extractUrlFromItem(payload);
  if (topLevelUrl) {
    pushSource({
      provider: "sugoi",
      isEmbed: false,
      hasAds: false,
      url: topLevelUrl,
      searchedEndpoint: "",
      raw: payload,
    });
  }

  const seen = new Set<string>();
  return output.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function fetchJson(url: string, timeoutMs = 12000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();
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

function normalizeSearchItems(payload: any) {
  const items = extractList(payload);
  return items
    .map((item: any, index: number) => {
      const title =
        item?.title ||
        item?.name ||
        item?.nome ||
        item?.anime_title ||
        item?.category_name ||
        "";

      const id = String(
        item?.id ||
          item?.animeId ||
          item?.anime_id ||
          item?.slug ||
          item?.url ||
          `sugoi-${index}`,
      );

      const image =
        item?.img ||
        item?.image ||
        item?.cover ||
        item?.thumb ||
        item?.poster ||
        item?.image_url ||
        item?.category_image ||
        "";

      const url = item?.url || item?.link || item?.source || "";
      const slug = resolveSlugHint(item, title);

      return {
        id: slug || id,
        title: String(title || "").trim(),
        image,
        url,
        slug,
        source: "Sugoi API",
        raw: {
          ...item,
          ...(slug ? { slug } : {}),
        },
      };
    })
    .filter((item) => item.title.length > 0);
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
    const slug = slugify(String(item?.slug || item?.raw?.slug || ""));
    const titleKey = normalizeKey(String(item?.title || ""));
    const urlKey = normalizeSearchUrl(item?.url);
    const key = slug ? `slug:${slug}` : urlKey ? `url:${urlKey}` : `title:${titleKey}`;

    if (!key || key === "title:") continue;

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, item);
      continue;
    }

    const currentScore =
      scoreTitleMatch(query, String(current?.title || "")) +
      (current?.image ? 8 : 0) +
      (current?.slug ? 4 : 0) +
      (current?.url ? 2 : 0);
    const nextScore =
      scoreTitleMatch(query, String(item?.title || "")) +
      (item?.image ? 8 : 0) +
      (item?.slug ? 4 : 0) +
      (item?.url ? 2 : 0);

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
  const fallbackSlug = slugify(item.raw?.slug || item.title || item.id);
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
  const encoded = encodeURIComponent(query);
  const paths = [
    `/search/${encoded}`,
    `/api/search/${encoded}`,
    `/search?q=${encoded}`,
    `/search?keyword=${encoded}`,
    `/api/search?q=${encoded}`,
    `/api/search?keyword=${encoded}`,
  ];

  const requestUrls: string[] = [];
  for (const base of getBases()) {
    for (const path of paths) {
      requestUrls.push(`${base}${path}`);
    }
  }

  const payloads = await Promise.all(
    requestUrls.map((url) => fetchJson(url, 9000)),
  );

  const sugoiResults = payloads
    .filter(Boolean)
    .flatMap((payload) => normalizeSearchItems(payload));

  let merged = sugoiResults;
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

  const episodeNumber = Number(episode);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json({ error: "episode deve ser um número >= 1" }, { status: 400 });
  }

  const bases = getBases();
  const encodedSlug = encodeURIComponent(slug);
  const encodedSeason = encodeURIComponent(season);
  const encodedEpisode = encodeURIComponent(episode);

  const sugoiPaths = [
    `/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/api/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/episodes/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/api/episodes/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/episode?slug=${encodedSlug}&season=${encodedSeason}&episode=${encodedEpisode}`,
    `/api/episode?slug=${encodedSlug}&season=${encodedSeason}&episode=${encodedEpisode}`,
  ];

  try {
    for (const base of bases) {
      for (const path of sugoiPaths) {
        const payload = await fetchJson(`${base}${path}`);
        if (!payload) continue;

        if (payload?.error && !payload?.data) continue;

        const sources = normalizeSources(payload);
        if (!sources.length) continue;

        return NextResponse.json({
          slug,
          season,
          episode,
          sources,
          primaryUrl: sources[0]?.url,
          provider: "sugoi",
        });
      }
    }

    const kappaFallback = await resolveKappaEpisodeBySlug(slug, episodeNumber);
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
      {
        error: "Nenhuma fonte encontrada na Sugoi e fallback Kappa falhou.",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("Sugoi proxy error", error);
    return NextResponse.json({ error: "Erro interno no proxy Sugoi" }, { status: 500 });
  }
}
