import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  getKappaEpisodes,
  getKappaEpisodeVideoUrl,
  ProviderKey,
  searchProviderWithFallback,
} from "@/lib/providers/search";
import prisma from "@/lib/prisma";
import {
  detectVideoSource,
  extractNestedMediaUrl,
  normalizePlaybackUrl,
} from "@/lib/video";

type SyncCandidate = {
  number: number;
  title: string;
  videoUrl: string;
  sourceLabel: string;
};

type SyncResult = {
  providerUsed: string;
  externalId?: string;
  imported: SyncCandidate[];
  failed: number;
};

function sourceRankForSync(url: string) {
  const kind = detectVideoSource(url || "");
  if (kind === "direct") return 4;
  if (kind === "google_drive") return 3;
  if (kind === "embed") return 2;
  if (kind === "youtube") return 1;
  return 0;
}

function dedupeImportedEpisodes(items: SyncCandidate[]) {
  const byNumber = new Map<number, SyncCandidate>();

  for (const item of items) {
    if (!Number.isFinite(item.number) || item.number <= 0) continue;

    const current = byNumber.get(item.number);
    if (!current) {
      byNumber.set(item.number, item);
      continue;
    }

    const currentRank = sourceRankForSync(current.videoUrl);
    const nextRank = sourceRankForSync(item.videoUrl);
    if (nextRank > currentRank) {
      byNumber.set(item.number, item);
      continue;
    }

    if (nextRank === currentRank && String(item.videoUrl || "").length > String(current.videoUrl || "").length) {
      byNumber.set(item.number, item);
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function normalizeKey(input: string) {
  return input
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

function parseEpisodeNumber(title: string, fallback: number) {
  const clean = title.toLowerCase();
  const match = clean.match(/(?:episodio|episodio|ep|cap(?:itulo)?)\s*[^0-9]{0,3}(\d{1,4})/i);
  if (match?.[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const trailing = clean.match(/(\d{1,4})(?!.*\d)/);
  if (trailing?.[1]) {
    const parsed = Number(trailing[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveSugoiSlug(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const direct = slugify(trimmed);
  if (direct && !/^\d+$/.test(direct) && /[a-z]/.test(direct)) {
    return direct;
  }

  try {
    const parsed = new URL(trimmed);
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

function parseImportMeta(description?: string | null) {
  if (!description) {
    return {
      provider: null as ProviderKey | null,
      externalId: "",
      query: "",
    };
  }

  const marker = description.match(/\[import-meta\s+([^\]]+)\]/i)?.[1] || "";
  if (!marker) {
    return {
      provider: null as ProviderKey | null,
      externalId: "",
      query: "",
    };
  }

  const values = marker
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split("=");
      if (!key || rest.length === 0) return acc;
      acc[key.trim().toLowerCase()] = rest.join("=").trim();
      return acc;
    }, {});

  const provider = values.provider as ProviderKey | undefined;
  const validProviders: ProviderKey[] = [
    "kappa",
    "sugoi",
    "anisbr",
    "anfire",
    "animefenix",
    "playanimes",
  ];

  return {
    provider: validProviders.includes(provider as ProviderKey)
      ? (provider as ProviderKey)
      : null,
    externalId: values.externalid || values.external_id || "",
    query: values.query || "",
  };
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
    const text = (await res.text())?.trim();
    if (!text) return null;

    const normalized = text.replace(/^\uFEFF/, "");
    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function bestItemByQuery<T extends { id?: string; title?: string; name?: string; category_name?: string }>(
  list: T[],
  query: string,
  externalId?: string,
) {
  if (!list.length) return null;
  if (externalId) {
    const match = list.find((item) => String(item.id || "") === String(externalId));
    if (match) return match;
  }

  return [...list]
    .sort((a, b) => {
      const aTitle = a.title || a.name || a.category_name || "";
      const bTitle = b.title || b.name || b.category_name || "";
      return scoreTitleMatch(query, bTitle) - scoreTitleMatch(query, aTitle);
    })
    .find(Boolean);
}

async function resolveKappaEpisodes(
  query: string,
  existingKeys: Set<string>,
  season: number,
  maxAdds: number,
  externalId?: string,
): Promise<SyncResult> {
  const searchResults = await searchProviderWithFallback("kappa", query);
  if (!searchResults.length) {
    return { providerUsed: "kappa", imported: [], failed: 0 };
  }

  const selected =
    (externalId
      ? searchResults.find((item) => String(item.id) === String(externalId))
      : null) ||
    [...searchResults].sort(
      (a, b) => scoreTitleMatch(query, b.title) - scoreTitleMatch(query, a.title),
    )[0];

  if (!selected?.id) {
    return { providerUsed: "kappa", imported: [], failed: 0 };
  }

  const episodes = (await getKappaEpisodes(selected.id)).sort((a, b) => a.number - b.number);
  const pending = episodes.filter((episode) => !existingKeys.has(`${season}:${episode.number}`));

  const imported: SyncCandidate[] = [];
  let failed = 0;

  for (const episode of pending) {
    if (imported.length >= maxAdds) break;
    const videoUrl = await getKappaEpisodeVideoUrl(episode.id);
    if (!videoUrl) {
      failed += 1;
      continue;
    }

    imported.push({
      number: episode.number,
      title: episode.title || `Episódio ${episode.number}`,
      videoUrl,
      sourceLabel: "Kappa API",
    });
  }

  return {
    providerUsed: "kappa",
    externalId: selected.id,
    imported,
    failed,
  };
}

function normalizeAtv2List(payload: any) {
  if (!Array.isArray(payload)) return [] as any[];
  return payload;
}

async function resolveAtv2Episodes(
  query: string,
  existingKeys: Set<string>,
  season: number,
  maxAdds: number,
  providerLabel: string,
  externalId?: string,
): Promise<SyncResult> {
  const searchPayload = await fetchJson(
    `https://atv2.net/meuanimetv-74.php?search=${encodeURIComponent(query)}`,
    12000,
  );
  const searchList = normalizeAtv2List(searchPayload);
  const selected = bestItemByQuery(searchList, query, externalId) as any;
  if (!selected?.id) {
    return { providerUsed: providerLabel, imported: [], failed: 0 };
  }

  const episodesPayload = await fetchJson(
    `https://atv2.net/meuanimetv-74.php?cat_id=${encodeURIComponent(String(selected.id))}`,
    12000,
  );
  const episodes = normalizeAtv2List(episodesPayload);

  const imported: SyncCandidate[] = [];
  let failed = 0;

  for (let i = 0; i < episodes.length; i += 1) {
    if (imported.length >= maxAdds) break;
    const item = episodes[i];
    const number = parseEpisodeNumber(item?.title || "", i + 1);
    const key = `${season}:${number}`;
    if (existingKeys.has(key)) continue;

    const videoId = item?.video_id;
    if (!videoId) {
      failed += 1;
      continue;
    }

    const details = await fetchJson(
      `https://api-playanimes.vercel.app/episodios/${encodeURIComponent(String(videoId))}`,
      12000,
    );
    const detailList = Array.isArray(details) ? details : [];
    const first = detailList[0] || {};
    const links = first?.links || {};
    const videoUrl =
      links?.link_one ||
      links?.link_two ||
      links?.link_three ||
      links?.link_four ||
      "";

    if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      failed += 1;
      continue;
    }

    imported.push({
      number,
      title: item?.title || `Episódio ${number}`,
      videoUrl,
      sourceLabel: providerLabel,
    });
  }

  return {
    providerUsed: providerLabel,
    externalId: String(selected.id),
    imported,
    failed,
  };
}

async function resolveAnfireEpisodes(
  query: string,
  existingKeys: Set<string>,
  season: number,
  maxAdds: number,
  externalId?: string,
): Promise<SyncResult> {
  const apiBase = process.env.ANFIRE_API_BASE?.trim();
  const apiKey = process.env.ANFIRE_API_KEY?.trim();
  if (!apiBase || !apiKey) {
    return { providerUsed: "anfire", imported: [], failed: 0 };
  }

  const slug = externalId || slugify(query);
  if (!slug) {
    return { providerUsed: "anfire", imported: [], failed: 0 };
  }

  const base = apiBase.replace(/\/+$/, "");
  const paths = [
    `/api.php?api_key=${encodeURIComponent(apiKey)}&anime_slug=${encodeURIComponent(slug)}&update=true`,
    `/?api_key=${encodeURIComponent(apiKey)}&anime_slug=${encodeURIComponent(slug)}&update=true`,
  ];

  let payload: any = null;
  for (const path of paths) {
    payload = await fetchJson(`${base}${path}`, 15000);
    if (payload?.episodes && Array.isArray(payload.episodes)) break;
  }

  const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
  if (!episodes.length) {
    return { providerUsed: "anfire", imported: [], failed: 0 };
  }

  const imported: SyncCandidate[] = [];
  let failed = 0;

  for (const item of episodes) {
    if (imported.length >= maxAdds) break;
    const number = Number(item?.episode);
    if (!Number.isFinite(number) || number <= 0) {
      failed += 1;
      continue;
    }

    const key = `${season}:${number}`;
    if (existingKeys.has(key)) continue;

    const streams = Array.isArray(item?.data) ? item.data : [];
    const firstOnline = streams.find((stream: any) => String(stream?.status || "").toUpperCase() === "ONLINE");
    const fallback = streams[0];
    const chosen = firstOnline || fallback;
    const videoUrl = chosen?.url;

    if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      failed += 1;
      continue;
    }

    imported.push({
      number,
      title: `Episódio ${number}`,
      videoUrl,
      sourceLabel: "AnFire API",
    });
  }

  return {
    providerUsed: "anfire",
    externalId: slug,
    imported,
    failed,
  };
}

const DEFAULT_SUGOI_BASES = [
  "https://sugoiapi.vercel.app",
  "https://sugoi-api.vercel.app",
];

function getSugoiBases() {
  const envBase = process.env.SUGOI_API_BASE?.trim();
  return [envBase, ...DEFAULT_SUGOI_BASES]
    .filter((base): base is string => Boolean(base))
    .map((base) => base.replace(/\/+$/, ""));
}

function extractSugoiList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.results,
    payload?.providers,
    payload?.sources,
    payload?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractSugoiUrl(item: any) {
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

function normalizeSugoiSources(payload: any) {
  const providerEntries = extractSugoiList(payload);
  const collected: { provider: string; isEmbed: boolean; url: string }[] = [];

  const pushSource = (provider: string, isEmbed: boolean, url: string) => {
    if (!url) return;
    collected.push({ provider, isEmbed, url });
  };

  for (const provider of providerEntries) {
    const providerName =
      provider?.name || provider?.slug || provider?.provider || "sugoi";
    const episodes = extractSugoiList(provider?.episodes);

    if (episodes.length > 0) {
      for (const episode of episodes) {
        pushSource(providerName, Boolean(provider?.is_embed), extractSugoiUrl(episode));
      }
    }

    pushSource(providerName, Boolean(provider?.is_embed), extractSugoiUrl(provider));
  }

  pushSource("sugoi", false, extractSugoiUrl(payload));

  const seen = new Set<string>();
  return collected.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function isLikelyDirectMediaUrl(url: string) {
  const value = String(url || "").toLowerCase();
  if (!value.startsWith("http")) return false;

  if (/\.(mp4|m4v|webm|ogg|mov|m3u8|mpd)(\?|#|$)/.test(value)) {
    return true;
  }

  const directHostHints = [
    "googlevideo.com",
    "akamaized.net",
    "cloudfront.net",
    "bunnycdn",
    "storage.googleapis.com",
    "wasabisys.com",
    "backblazeb2.com",
  ];

  return directHostHints.some((hint) => value.includes(hint));
}

function normalizeSourceForDedupe(url: string) {
  const normalized = normalizePlaybackUrl(url || "");
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    ["token", "signature", "sig", "expires", "exp", "download"].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch {
    return normalized;
  }
}

async function resolveSugoiEpisodeSources(slug: string, season: number, episode: number) {
  const encodedSlug = encodeURIComponent(slug);
  const encodedSeason = encodeURIComponent(String(season));
  const encodedEpisode = encodeURIComponent(String(episode));
  const paths = [
    `/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/api/episode/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/episodes/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/api/episodes/${encodedSlug}/${encodedSeason}/${encodedEpisode}`,
    `/episode?slug=${encodedSlug}&season=${encodedSeason}&episode=${encodedEpisode}`,
    `/api/episode?slug=${encodedSlug}&season=${encodedSeason}&episode=${encodedEpisode}`,
  ];

  const bases = getSugoiBases();
  for (const base of bases) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      if (!payload || (payload?.error && !payload?.data)) continue;
      const sources = normalizeSugoiSources(payload);
      if (sources.length > 0) return sources;
    }
  }

  return [] as { provider: string; isEmbed: boolean; url: string }[];
}

async function resolveSugoiEpisodes(
  query: string,
  existingKeys: Set<string>,
  season: number,
  maxAdds: number,
  externalId?: string,
): Promise<SyncResult> {
  const slug = resolveSugoiSlug(externalId || "") || resolveSugoiSlug(query || "");
  if (!slug) {
    return { providerUsed: "sugoi", imported: [], failed: 0 };
  }

  const imported: SyncCandidate[] = [];
  let failed = 0;
  let misses = 0;
  let foundAny = false;
  const maxScan = Math.max(maxAdds * 3, 40);
  const seenSourceUrls = new Set<string>();

  for (let episodeNumber = 1; episodeNumber <= maxScan; episodeNumber += 1) {
    if (imported.length >= maxAdds) break;

    const key = `${season}:${episodeNumber}`;
    if (existingKeys.has(key)) {
      foundAny = true;
      continue;
    }

    const sources = await resolveSugoiEpisodeSources(slug, season, episodeNumber);
    if (!sources.length) {
      misses += 1;
      if (misses >= (foundAny ? 4 : 9)) break;
      continue;
    }

    foundAny = true;
    misses = 0;

    const best =
      sources.find((source) => !source.isEmbed && isLikelyDirectMediaUrl(source.url)) ||
      sources.find((source) => source.isEmbed) ||
      sources.find((source) => !source.isEmbed) ||
      sources[0];
    if (!best?.url) {
      failed += 1;
      continue;
    }

    const sourceKey = normalizeSourceForDedupe(best.url);
    if (sourceKey && seenSourceUrls.has(sourceKey)) {
      failed += 1;
      continue;
    }

    if (sourceKey) {
      seenSourceUrls.add(sourceKey);
    }

    imported.push({
      number: episodeNumber,
      title: `Episódio ${episodeNumber}`,
      videoUrl: best.url,
      sourceLabel: `Sugoi API (${best.provider})`,
    });
  }

  return {
    providerUsed: "sugoi",
    externalId: slug,
    imported,
    failed,
  };
}

async function resolveProviderEpisodes(
  provider: ProviderKey,
  query: string,
  existingKeys: Set<string>,
  season: number,
  maxAdds: number,
  externalId?: string,
) {
  if (provider === "sugoi") {
    return resolveSugoiEpisodes(
      query,
      existingKeys,
      season,
      maxAdds,
      externalId,
    );
  }

  if (provider === "playanimes") {
    const play = await resolveAtv2Episodes(
      query,
      existingKeys,
      season,
      maxAdds,
      "PlayAnimes API",
      externalId,
    );
    if (play.imported.length > 0) return play;
    return resolveKappaEpisodes(query, existingKeys, season, maxAdds, externalId);
  }

  if (provider === "anfire") {
    const anfire = await resolveAnfireEpisodes(
      query,
      existingKeys,
      season,
      maxAdds,
      externalId,
    );
    if (anfire.imported.length > 0) return anfire;

    const mirror = await resolveAtv2Episodes(
      query,
      existingKeys,
      season,
      maxAdds,
      "AnFire (mirror ATV2)",
      externalId,
    );
    if (mirror.imported.length > 0) return mirror;

    return resolveKappaEpisodes(query, existingKeys, season, maxAdds, externalId);
  }

  if (provider === "animefenix") {
    const mirror = await resolveAtv2Episodes(
      query,
      existingKeys,
      season,
      maxAdds,
      "AnimeFenix (mirror ATV2)",
      externalId,
    );
    if (mirror.imported.length > 0) return mirror;
    return resolveKappaEpisodes(query, existingKeys, season, maxAdds, externalId);
  }

  if (provider === "anisbr") {
    const mirror = await resolveAtv2Episodes(
      query,
      existingKeys,
      season,
      maxAdds,
      "AnimesBrasil (mirror ATV2)",
      externalId,
    );
    if (mirror.imported.length > 0) return mirror;
    return resolveKappaEpisodes(query, existingKeys, season, maxAdds, externalId);
  }

  return resolveKappaEpisodes(query, existingKeys, season, maxAdds, externalId);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const animeId = String(body?.animeId || "").trim();
    if (!animeId) {
      return NextResponse.json({ error: "animeId é obrigatório" }, { status: 400 });
    }

    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          select: { season: true, number: true, videoUrl: true },
          orderBy: [{ season: "asc" }, { number: "asc" }],
        },
      },
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime não encontrado" }, { status: 404 });
    }

    const descriptionMeta = parseImportMeta(anime.description);
    const providerInput = String(body?.provider || "").trim().toLowerCase() as ProviderKey;
    const provider: ProviderKey =
      ([
        "kappa",
        "sugoi",
        "anisbr",
        "anfire",
        "animefenix",
        "playanimes",
      ] as ProviderKey[]).includes(providerInput)
        ? providerInput
        : descriptionMeta.provider || "kappa";

    const query = String(body?.query || descriptionMeta.query || anime.title || "").trim();
    if (!query) {
      return NextResponse.json({ error: "Não foi possível determinar a busca do anime" }, { status: 400 });
    }

    const externalId = String(body?.externalId || descriptionMeta.externalId || "").trim();
    const seasonRaw = Number(body?.season || 1);
    const season = Number.isFinite(seasonRaw) && seasonRaw > 0 ? Math.floor(seasonRaw) : 1;
    const limitRaw = Number(body?.limit || 30);
    const maxAdds = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 30));

    const existingKeys = new Set(
      anime.episodes.map((episode) => `${episode.season}:${episode.number}`),
    );
    const existingSourceUrls = new Set(
      anime.episodes
        .map((episode) => normalizeSourceForDedupe(episode.videoUrl || ""))
        .filter(Boolean),
    );

    const resolved = await resolveProviderEpisodes(
      provider,
      query,
      existingKeys,
      season,
      maxAdds,
      externalId || undefined,
    );

    const dedupedImported = dedupeImportedEpisodes(resolved.imported);

    if (!dedupedImported.length) {
      return NextResponse.json({
        ok: true,
        animeId: anime.id,
        animeTitle: anime.title,
        providerRequested: provider,
        providerUsed: resolved.providerUsed,
        imported: 0,
        importedCount: 0,
        failed: resolved.failed,
        deduped: resolved.imported.length,
        message: "Nenhum episódio novo encontrado no momento.",
      });
    }

    let created = 0;
    for (const episode of dedupedImported) {
      const key = `${season}:${episode.number}`;
      if (existingKeys.has(key)) continue;

      const normalizedVideoUrl = normalizePlaybackUrl(episode.videoUrl || "");
      if (!normalizedVideoUrl) continue;

      let finalVideoUrl = normalizedVideoUrl;
      const detectedType = detectVideoSource(normalizedVideoUrl);
      if (detectedType !== "direct") {
        const nestedMedia = extractNestedMediaUrl(normalizedVideoUrl);
        if (nestedMedia) {
          const nestedType = detectVideoSource(nestedMedia, "direct");
          if (nestedType === "direct") {
            finalVideoUrl = nestedMedia;
          }
        }
      }

      const sourceKey = normalizeSourceForDedupe(finalVideoUrl);
      if (sourceKey && existingSourceUrls.has(sourceKey)) {
        continue;
      }

      await prisma.episode.create({
        data: {
          animeId: anime.id,
          title: episode.title,
          season,
          number: episode.number,
          videoUrl: finalVideoUrl,
          sourceLabel: episode.sourceLabel,
          sourceType: detectVideoSource(finalVideoUrl),
        },
      });

      existingKeys.add(key);
      if (sourceKey) {
        existingSourceUrls.add(sourceKey);
      }
      created += 1;
    }

    return NextResponse.json({
      ok: true,
      animeId: anime.id,
      animeTitle: anime.title,
      providerRequested: provider,
      providerUsed: resolved.providerUsed,
      externalId: resolved.externalId || externalId || null,
      imported: created,
      importedCount: created,
      failed: resolved.failed,
      deduped: Math.max(0, resolved.imported.length - dedupedImported.length),
      scanned: dedupedImported.length + resolved.failed,
      message:
        created > 0
          ? `${created} episódio(s) importado(s) com sucesso.`
          : "Nenhum episódio novo importado.",
    });
  } catch (error) {
    console.error("Anime sync API error", error);
    return NextResponse.json({ error: "Erro interno ao sincronizar episódios" }, { status: 500 });
  }
}
/**
 * Admin anime synchronization endpoint for provider refresh workflows.
 */
