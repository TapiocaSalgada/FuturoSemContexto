import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  getKappaEpisodeVideoUrl,
  getKappaEpisodes,
  resolveKappaEpisodeBySlug,
  searchProviderWithFallback,
} from "@/lib/providers/search";
import prisma from "@/lib/prisma";
import { normalizeSettings } from "@/lib/settings";
import {
  buildGoogleDriveDirectCandidates,
  VideoSourceKind,
  detectVideoSource,
  extractNestedMediaUrl,
  normalizePlaybackUrl,
  toEmbeddableVideoUrl,
} from "@/lib/video";
import { isPublicVisibility } from "@/lib/visibility";

const DEFAULT_SUGOI_BASES = [
  "https://sugoiapi.vercel.app",
  "https://sugoi-api.vercel.app",
];

type SugoiSource = {
  provider: string;
  isEmbed: boolean;
  url: string;
};

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
      provider: "",
      externalId: "",
      query: "",
    };
  }

  const marker = description.match(/\[import-meta\s+([^\]]+)\]/i)?.[1] || "";
  if (!marker) {
    return {
      provider: "",
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

  return {
    provider: (values.provider || "").toLowerCase(),
    externalId: values.externalid || values.external_id || "",
    query: values.query || "",
  };
}

function getSugoiBases() {
  const envBase = process.env.SUGOI_API_BASE?.trim();
  return [envBase, ...DEFAULT_SUGOI_BASES]
    .filter((base): base is string => Boolean(base))
    .map((base) => base.replace(/\/+$/, ""));
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

function extractUrl(item: any) {
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
  const match = clean.match(/(?:episodio|ep|cap(?:itulo)?)\s*[^0-9]{0,3}(\d{1,4})/i);
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

function normalizeAtv2List(payload: any) {
  if (!Array.isArray(payload)) return [] as any[];
  return payload;
}

function bestItemByQuery<T extends { id?: string; title?: string; name?: string; category_name?: string }>(
  list: T[],
  query: string,
  externalId?: string,
) {
  if (!list.length) return null;
  if (externalId) {
    const byId = list.find((item) => String(item.id || "") === String(externalId));
    if (byId) return byId;
  }

  return [...list]
    .sort((a, b) => {
      const aTitle = a.title || a.name || a.category_name || "";
      const bTitle = b.title || b.name || b.category_name || "";
      return scoreTitleMatch(query, bTitle) - scoreTitleMatch(query, aTitle);
    })
    .find(Boolean);
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
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSugoiSources(payload: any) {
  const providers = extractList(payload);
  const sources: SugoiSource[] = [];

  const pushSource = (provider: string, isEmbed: boolean, url: string) => {
    if (!url) return;
    sources.push({ provider, isEmbed, url });
  };

  for (const provider of providers) {
    const providerName = provider?.name || provider?.slug || provider?.provider || "sugoi";
    const episodes = extractList(provider?.episodes);

    for (const item of episodes) {
      pushSource(providerName, Boolean(provider?.is_embed), extractUrl(item));
    }

    pushSource(providerName, Boolean(provider?.is_embed), extractUrl(provider));
  }

  pushSource("sugoi", false, extractUrl(payload));

  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

async function resolveSugoiSources(slug: string, season: number, episode: number) {
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

  for (const base of getSugoiBases()) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      if (!payload || (payload?.error && !payload?.data)) continue;
      const sources = normalizeSugoiSources(payload);
      if (sources.length > 0) return sources;
    }
  }

  return [] as SugoiSource[];
}

async function resolveKappaSourceByAnimeId(animeId: string, episodeNumber: number) {
  if (!animeId) return null;

  const episodes = await getKappaEpisodes(animeId);
  if (!episodes.length) return null;

  const target =
    episodes.find((item) => item.number === episodeNumber) ||
    episodes[Math.max(0, Math.min(episodes.length - 1, episodeNumber - 1))];

  if (!target?.id) return null;

  const videoUrl = await getKappaEpisodeVideoUrl(target.id);
  if (!videoUrl) return null;

  return {
    videoUrl,
    episodeId: target.id,
  };
}

async function resolveKappaSourceByQuery(
  query: string,
  episodeNumber: number,
  externalId?: string,
) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return null;

  const searchResults = await searchProviderWithFallback("kappa", normalizedQuery);
  if (!searchResults.length) return null;

  const selected = bestItemByQuery(searchResults, normalizedQuery, externalId) as any;
  if (!selected?.id) return null;

  return resolveKappaSourceByAnimeId(String(selected.id), episodeNumber);
}

async function resolveAtv2EpisodeSource(
  query: string,
  episodeNumber: number,
  externalId?: string,
) {
  const searchPayload = await fetchJson(
    `https://atv2.net/meuanimetv-74.php?search=${encodeURIComponent(query)}`,
    12000,
  );
  const searchList = normalizeAtv2List(searchPayload);
  const selected = bestItemByQuery(searchList, query, externalId) as any;
  if (!selected?.id) return null;

  const episodesPayload = await fetchJson(
    `https://atv2.net/meuanimetv-74.php?cat_id=${encodeURIComponent(String(selected.id))}`,
    12000,
  );
  const episodes = normalizeAtv2List(episodesPayload);
  if (!episodes.length) return null;

  const targetByNumber = episodes.find(
    (item: any, index: number) =>
      parseEpisodeNumber(String(item?.title || ""), index + 1) === episodeNumber,
  );
  const targetFallback = episodes[Math.max(0, Math.min(episodes.length - 1, episodeNumber - 1))];
  const target = targetByNumber || targetFallback;

  const videoId = target?.video_id;
  if (!videoId) return null;

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

  if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) return null;

  return {
    videoUrl,
    sourceLabel: "Brasil (ATV2/PlayAnimes)",
  };
}

async function resolveAnfireEpisodeSource(
  query: string,
  episodeNumber: number,
  externalId?: string,
) {
  const apiBase = process.env.ANFIRE_API_BASE?.trim();
  const apiKey = process.env.ANFIRE_API_KEY?.trim();
  if (!apiBase || !apiKey) return null;

  const slug = externalId || slugify(query);
  if (!slug) return null;

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
  if (!episodes.length) return null;

  const byNumber = episodes.find((item: any) => Number(item?.episode) === episodeNumber);
  const fallback = episodes.find((item: any) => Array.isArray(item?.data) && item.data.length > 0);
  const target = byNumber || fallback;
  if (!target) return null;

  const streams = Array.isArray(target?.data) ? target.data : [];
  const firstOnline = streams.find((stream: any) => String(stream?.status || "").toUpperCase() === "ONLINE");
  const chosen = firstOnline || streams[0];
  const videoUrl = chosen?.url;
  if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) return null;

  return {
    videoUrl,
    sourceLabel: "Brasil (AnFire)",
  };
}

async function probeSourceUrl(url: string, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        range: "bytes=0-1024",
        "user-agent": "Mozilla/5.0 FuturoStreamProbe/1.0",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return false;

    const disposition = (res.headers.get("content-disposition") || "").toLowerCase();
    if (disposition.includes("attachment")) return false;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return false;

    return true;
  } catch {
    return false;
  }
}

function isLikelyMediaDeliveryUrl(url: string) {
  const value = normalizePlaybackUrl(url || "").toLowerCase();
  if (!value.startsWith("http")) return false;

  if (/\.(mp4|m4v|webm|ogg|mov|m3u8|mpd|ts)(\?|#|$)/.test(value)) {
    return true;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return [
      "googlevideo.com",
      "akamaized.net",
      "cloudfront.net",
      "bunnycdn",
      "storage.googleapis.com",
      "wasabisys.com",
      "backblazeb2.com",
    ].some((hint) => host.includes(hint));
  } catch {
    return false;
  }
}

function isLikelyDownloadOnlyUrl(url: string) {
  const value = normalizePlaybackUrl(url || "").toLowerCase();
  if (!value.startsWith("http")) return false;
  if (isLikelyMediaDeliveryUrl(value)) return false;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isGoogleDriveDirect =
      (host.includes("drive.google.com") &&
        parsed.pathname.toLowerCase().startsWith("/uc") &&
        parsed.searchParams.has("id")) ||
      (host.includes("drive.usercontent.google.com") && parsed.searchParams.has("id"));

    if (isGoogleDriveDirect) {
      return false;
    }
  } catch {
    // ignore parse errors and continue heuristic checks
  }

  return (
    /(?:^|[?&])(download|dl|attachment)=1(?:&|$)/.test(value) ||
    /(?:^|[?&])export=download(?:&|$)/.test(value) ||
    /(?:^|[?&])response-content-disposition=attachment(?:&|$)/.test(value) ||
    /\/download(?:\/|$)/.test(value) ||
    /\/dl(?:\/|$)/.test(value)
  );
}

function sourcePriority(source: { label?: string; url: string; type: VideoSourceKind }) {
  let score = 0;

  if (source.type === "direct") score += 50;
  else if (source.type === "embed" || source.type === "google_drive" || source.type === "youtube") score += 35;
  else score += 20;

  if (isLikelyMediaDeliveryUrl(source.url)) score += 20;
  if (isLikelyDownloadOnlyUrl(source.url)) score -= 25;

  const label = String(source.label || "").toLowerCase();
  if (label.includes("principal")) score += 3;
  if (label.includes("fallback")) score -= 4;

  return score;
}

function filterUnsafeSources(sources: { label: string; url: string; type: VideoSourceKind }[]) {
  const hasSafeDirect = sources.some(
    (source) => source.type === "direct" && !isLikelyDownloadOnlyUrl(source.url),
  );
  const hasEmbeddable = sources.some((source) => source.type !== "direct");

  if (!hasSafeDirect && !hasEmbeddable) {
    return sources;
  }

  return sources.filter(
    (source) => !(source.type === "direct" && isLikelyDownloadOnlyUrl(source.url)),
  );
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const user = userEmail
      ? await prisma.user.findUnique({
          where: { email: userEmail },
          select: {
            id: true,
            isPrivate: true,
            settings: {
              select: {
                theme: true,
                reducedMotion: true,
                neonEffects: true,
                showHistory: true,
                autoplay: true,
                resumePlayback: true,
                allowFollow: true,
                playbackSpeed: true,
                notifyAnnouncements: true,
                notifyEpisodes: true,
                notifyFollowers: true,
                notifyReplies: true,
              },
            },
          },
        })
      : null;

    const anime = await prisma.anime.findUnique({
      where: { id: params.id },
      include: {
        episodes: {
          orderBy: [{ season: "asc" }, { number: "asc" }],
        },
      },
    });

    let episodeToPlay = null as
      | (Awaited<ReturnType<typeof prisma.episode.findUnique>> & {
          anime?: Awaited<ReturnType<typeof prisma.anime.findUnique>>;
        })
      | null;
    let animeData = anime;

    if (anime) {
      if (user?.id) {
        const recentHistory = await prisma.watchHistory.findFirst({
          where: {
            userId: user.id,
            episode: {
              animeId: anime.id,
            },
          },
          orderBy: { updatedAt: "desc" },
          select: { episodeId: true },
        });

        if (recentHistory?.episodeId) {
          episodeToPlay = anime.episodes.find((item) => item.id === recentHistory.episodeId) || null;
        }
      }

      if (!episodeToPlay) {
        episodeToPlay = anime.episodes[0] || null;
      }
    } else {
      const episode = await prisma.episode.findUnique({
        where: { id: params.id },
        include: {
          anime: {
            include: {
              episodes: {
                orderBy: [{ season: "asc" }, { number: "asc" }],
              },
            },
          },
        },
      });
      if (episode) {
        episodeToPlay = episode;
        animeData = episode.anime as any;
      }
    }

    if (!animeData || !episodeToPlay) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isPublicVisibility(animeData.visibility)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const playlist = (animeData.episodes || []).slice().sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.number - b.number;
    });
    const currentIndex = playlist.findIndex(
      (episode) => episode.id === episodeToPlay?.id,
    );
    const currentEpisode =
      currentIndex >= 0 ? playlist[currentIndex] : episodeToPlay;
    const nextEpisode =
      currentIndex >= 0 ? playlist[currentIndex + 1] || null : null;
    const prevEpisode =
      currentIndex > 0 ? playlist[currentIndex - 1] || null : null;

    let resolvedVideoUrl = normalizePlaybackUrl(currentEpisode?.videoUrl || "");
    let resolvedSourceType: VideoSourceKind = detectVideoSource(
      resolvedVideoUrl,
      currentEpisode?.sourceType,
    );
    const sources: { label: string; url: string; type: VideoSourceKind }[] = [];
    const sourceSet = new Set<string>();

    const pushSource = (label: string, url?: string | null, sourceType?: string | null) => {
      const normalizedUrl = normalizePlaybackUrl(url || "");
      if (!normalizedUrl) return;
      const type: VideoSourceKind = detectVideoSource(normalizedUrl, sourceType || undefined);
      const key = `${type}:${normalizedUrl}`;
      if (sourceSet.has(key)) return;
      sourceSet.add(key);
      sources.push({ label, url: normalizedUrl, type });

      if (type !== "direct") {
        const nestedMedia = extractNestedMediaUrl(normalizedUrl);
        if (nestedMedia && nestedMedia !== normalizedUrl) {
          const nestedType: VideoSourceKind = detectVideoSource(nestedMedia, "direct");
          if (nestedType === "direct") {
            const nestedKey = `${nestedType}:${nestedMedia}`;
            if (!sourceSet.has(nestedKey)) {
              sourceSet.add(nestedKey);
              sources.push({
                label: `${label} direto`,
                url: nestedMedia,
                type: nestedType,
              });
            }
          }
        }
      }

      if (type === "google_drive") {
        const driveCandidates = buildGoogleDriveDirectCandidates(normalizedUrl);
        for (const driveUrl of driveCandidates) {
          const driveType: VideoSourceKind = detectVideoSource(driveUrl, "direct");
          if (driveType !== "direct") continue;

          const driveKey = `${driveType}:${driveUrl}`;
          if (sourceSet.has(driveKey)) continue;

          sourceSet.add(driveKey);
          sources.push({
            label: `${label} html5`,
            url: driveUrl,
            type: driveType,
          });
        }
      }
    };

    if (resolvedVideoUrl) {
      pushSource("Principal", resolvedVideoUrl, resolvedSourceType);
    }

    const importMeta = parseImportMeta(animeData.description);
    const providerQuery = String(importMeta.query || animeData.title || "").trim();
    const isSugoiContext =
      importMeta.provider === "sugoi" ||
      /sugoi/i.test(currentEpisode?.sourceLabel || "");
    const isKappaContext =
      importMeta.provider === "kappa" ||
      /kappa/i.test(currentEpisode?.sourceLabel || "");
    const isBrMirrorContext =
      ["playanimes", "anisbr", "animefenix"].includes(importMeta.provider) ||
      /(playanimes|animes?brasil|animefenix|atv2)/i.test(currentEpisode?.sourceLabel || "");
    const isAnfireContext =
      importMeta.provider === "anfire" ||
      /anfire/i.test(currentEpisode?.sourceLabel || "");

    let triedAtv2 = false;
    let triedAnfire = false;

    const sugoiSlug =
      resolveSugoiSlug(importMeta.externalId || "") ||
      resolveSugoiSlug(importMeta.query || "") ||
      resolveSugoiSlug(animeData.title || "");

    if (isKappaContext) {
      let refreshedKappa = null as Awaited<ReturnType<typeof resolveKappaSourceByAnimeId>> | null;

      if (importMeta.externalId) {
        refreshedKappa = await resolveKappaSourceByAnimeId(
          importMeta.externalId,
          currentEpisode.number,
        );
      }

      if (!refreshedKappa && providerQuery) {
        refreshedKappa = await resolveKappaSourceByQuery(
          providerQuery,
          currentEpisode.number,
          importMeta.externalId || undefined,
        );
      }

      if (refreshedKappa?.videoUrl) {
        pushSource("Kappa atualizado", refreshedKappa.videoUrl, "direct");
        if (!resolvedVideoUrl || resolvedSourceType !== "direct" || isLikelyDownloadOnlyUrl(resolvedVideoUrl)) {
          resolvedVideoUrl = refreshedKappa.videoUrl;
          resolvedSourceType = detectVideoSource(refreshedKappa.videoUrl, "direct");
        }
      }
    }

    if (isBrMirrorContext && providerQuery) {
      triedAtv2 = true;
      const refreshedAtv2 = await resolveAtv2EpisodeSource(
        providerQuery,
        currentEpisode.number,
        importMeta.externalId,
      );
      if (refreshedAtv2?.videoUrl) {
        pushSource(refreshedAtv2.sourceLabel, refreshedAtv2.videoUrl, "direct");
        if (!resolvedVideoUrl || resolvedSourceType !== "direct" || isLikelyDownloadOnlyUrl(resolvedVideoUrl)) {
          resolvedVideoUrl = refreshedAtv2.videoUrl;
          resolvedSourceType = detectVideoSource(refreshedAtv2.videoUrl, "direct");
        }
      }
    }

    if (isAnfireContext && providerQuery) {
      triedAnfire = true;
      const refreshedAnfire = await resolveAnfireEpisodeSource(
        providerQuery,
        currentEpisode.number,
        importMeta.externalId,
      );
      if (refreshedAnfire?.videoUrl) {
        pushSource(refreshedAnfire.sourceLabel, refreshedAnfire.videoUrl, "direct");
        if (!resolvedVideoUrl || resolvedSourceType !== "direct" || isLikelyDownloadOnlyUrl(resolvedVideoUrl)) {
          resolvedVideoUrl = refreshedAnfire.videoUrl;
          resolvedSourceType = detectVideoSource(refreshedAnfire.videoUrl, "direct");
        }
      }
    }

    if (isSugoiContext && sugoiSlug) {
      const sugoiSources = await resolveSugoiSources(
        sugoiSlug,
        currentEpisode?.season || 1,
        currentEpisode.number,
      );

      for (const source of sugoiSources) {
        pushSource(
          `Sugoi ${source.provider}`,
          source.url,
          source.isEmbed ? "embed" : undefined,
        );
      }

      const preferredSugoi = sugoiSources.find((source) => !source.isEmbed) || sugoiSources[0];
      if (
        preferredSugoi?.url &&
        (!resolvedVideoUrl || resolvedSourceType === "embed" || resolvedSourceType === "external")
      ) {
        resolvedVideoUrl = preferredSugoi.url;
        resolvedSourceType = detectVideoSource(
          preferredSugoi.url,
          preferredSugoi.isEmbed ? "embed" : undefined,
        );
      }
    }

    if (!resolvedVideoUrl && sugoiSlug) {
      const fallback = await resolveKappaEpisodeBySlug(
        sugoiSlug,
        currentEpisode.number,
      );
      if (fallback?.videoUrl) {
        pushSource("Kappa fallback", fallback.videoUrl, "direct");
        resolvedVideoUrl = normalizePlaybackUrl(fallback.videoUrl);
        resolvedSourceType = detectVideoSource(resolvedVideoUrl, "direct");
      }
    }

    if (!resolvedVideoUrl && providerQuery) {
      if (!triedAtv2) {
        const fallbackAtv2 = await resolveAtv2EpisodeSource(
          providerQuery,
          currentEpisode.number,
          importMeta.externalId,
        );
        if (fallbackAtv2?.videoUrl) {
          pushSource(fallbackAtv2.sourceLabel, fallbackAtv2.videoUrl, "direct");
          resolvedVideoUrl = normalizePlaybackUrl(fallbackAtv2.videoUrl);
          resolvedSourceType = detectVideoSource(resolvedVideoUrl, "direct");
        }
      }

      if (!resolvedVideoUrl && !triedAnfire) {
        const fallbackAnfire = await resolveAnfireEpisodeSource(
          providerQuery,
          currentEpisode.number,
          importMeta.externalId,
        );
        if (fallbackAnfire?.videoUrl) {
          pushSource(fallbackAnfire.sourceLabel, fallbackAnfire.videoUrl, "direct");
          resolvedVideoUrl = normalizePlaybackUrl(fallbackAnfire.videoUrl);
          resolvedSourceType = detectVideoSource(resolvedVideoUrl, "direct");
        }
      }
    }

    if (providerQuery && (sources.length < 2 || resolvedSourceType !== "direct")) {
      if (!triedAtv2) {
        const extraAtv2 = await resolveAtv2EpisodeSource(
          providerQuery,
          currentEpisode.number,
          importMeta.externalId,
        );
        triedAtv2 = true;
        if (extraAtv2?.videoUrl) {
          pushSource(extraAtv2.sourceLabel, extraAtv2.videoUrl, "direct");
          if (!resolvedVideoUrl || resolvedSourceType !== "direct") {
            resolvedVideoUrl = extraAtv2.videoUrl;
            resolvedSourceType = detectVideoSource(extraAtv2.videoUrl, "direct");
          }
        }
      }

      if (!triedAnfire) {
        const extraAnfire = await resolveAnfireEpisodeSource(
          providerQuery,
          currentEpisode.number,
          importMeta.externalId,
        );
        triedAnfire = true;
        if (extraAnfire?.videoUrl) {
          pushSource(extraAnfire.sourceLabel, extraAnfire.videoUrl, "direct");
          if (!resolvedVideoUrl || resolvedSourceType !== "direct") {
            resolvedVideoUrl = extraAnfire.videoUrl;
            resolvedSourceType = detectVideoSource(extraAnfire.videoUrl, "direct");
          }
        }
      }
    }

    if (sources.length > 0) {
      sources.sort((a, b) => sourcePriority(b) - sourcePriority(a));
      const preferred = sources[0];
      const currentLooksDownloadOnly = isLikelyDownloadOnlyUrl(resolvedVideoUrl || "");
      if (!resolvedVideoUrl || resolvedSourceType !== "direct" || currentLooksDownloadOnly) {
        resolvedVideoUrl = preferred.url;
        resolvedSourceType = preferred.type;
      }
    }

    if (resolvedVideoUrl && resolvedSourceType === "direct") {
      const currentLooksDownloadOnly = isLikelyDownloadOnlyUrl(resolvedVideoUrl);
      let healthy = !currentLooksDownloadOnly && await probeSourceUrl(resolvedVideoUrl);
      if (!healthy) {
        const embeddable = toEmbeddableVideoUrl(resolvedVideoUrl, "direct");
        if (embeddable && embeddable !== resolvedVideoUrl) {
          pushSource("Embed adaptado", embeddable, "embed");
        }

        const directCandidates = sources.filter(
          (source) => source.type === "direct" && source.url !== resolvedVideoUrl,
        );

        const preferredDirect = directCandidates.filter(
          (source) => !isLikelyDownloadOnlyUrl(source.url),
        );
        const backupDirect = directCandidates.filter((source) => isLikelyDownloadOnlyUrl(source.url));

        for (const candidate of [...preferredDirect, ...backupDirect]) {
          const candidateLooksDownloadOnly = isLikelyDownloadOnlyUrl(candidate.url);
          if (candidateLooksDownloadOnly && preferredDirect.length > 0) continue;

          const candidateHealthy = await probeSourceUrl(candidate.url, 4200);
          if (!candidateHealthy) continue;
          resolvedVideoUrl = candidate.url;
          resolvedSourceType = candidate.type;
          healthy = true;
          break;
        }

    if (!healthy) {
      const nonDirect = sources.find(
        (source) => source.type !== "direct" && source.url !== resolvedVideoUrl,
      );
      if (nonDirect) {
        resolvedVideoUrl = nonDirect.url;
        resolvedSourceType = nonDirect.type;
        healthy = true;
      }
    }

        if (!healthy && providerQuery) {
          if (!triedAtv2) {
            const rescueAtv2 = await resolveAtv2EpisodeSource(
              providerQuery,
              currentEpisode.number,
              importMeta.externalId,
            );
            triedAtv2 = true;
            if (rescueAtv2?.videoUrl) {
              pushSource(rescueAtv2.sourceLabel, rescueAtv2.videoUrl, "direct");
              resolvedVideoUrl = normalizePlaybackUrl(rescueAtv2.videoUrl);
              resolvedSourceType = detectVideoSource(resolvedVideoUrl, "direct");
              healthy = true;
            }
          }

          if (!healthy && !triedAnfire) {
            const rescueAnfire = await resolveAnfireEpisodeSource(
              providerQuery,
              currentEpisode.number,
              importMeta.externalId,
            );
            triedAnfire = true;
            if (rescueAnfire?.videoUrl) {
              pushSource(rescueAnfire.sourceLabel, rescueAnfire.videoUrl, "direct");
              resolvedVideoUrl = normalizePlaybackUrl(rescueAnfire.videoUrl);
              resolvedSourceType = detectVideoSource(resolvedVideoUrl, "direct");
              healthy = true;
            }
          }
        }
      }
    }

    if (!resolvedVideoUrl && sources.length > 0) {
      const fallbackPlayable =
        sources.find((source) => source.type !== "direct" || !isLikelyDownloadOnlyUrl(source.url)) ||
        sources[0];
      resolvedVideoUrl = fallbackPlayable.url;
      resolvedSourceType = fallbackPlayable.type;
    }

    if (resolvedVideoUrl && resolvedSourceType === "direct" && isLikelyDownloadOnlyUrl(resolvedVideoUrl)) {
      const saferDirect = sources.find(
        (source) => source.type === "direct" && !isLikelyDownloadOnlyUrl(source.url),
      );

      if (saferDirect) {
        resolvedVideoUrl = saferDirect.url;
        resolvedSourceType = saferDirect.type;
      } else {
        const fallbackNonDirect = sources.find((source) => source.type !== "direct");
        if (fallbackNonDirect) {
          resolvedVideoUrl = fallbackNonDirect.url;
          resolvedSourceType = fallbackNonDirect.type;
        } else {
          const embeddable = toEmbeddableVideoUrl(resolvedVideoUrl, "direct");
          if (embeddable && embeddable !== resolvedVideoUrl) {
            resolvedVideoUrl = embeddable;
            resolvedSourceType = detectVideoSource(embeddable, "embed");
          } else {
            resolvedVideoUrl = "";
            resolvedSourceType = "external";
          }
        }
      }
    }

    const safeSources = filterUnsafeSources(sources);
    if (resolvedVideoUrl && safeSources.length > 0) {
      const inSafeList = safeSources.some(
        (source) => source.url === resolvedVideoUrl && source.type === resolvedSourceType,
      );
      if (!inSafeList) {
        resolvedVideoUrl = safeSources[0].url;
        resolvedSourceType = safeSources[0].type;
      }
    }

    let history = null;
    let viewerSettings = normalizeSettings();
    if (user) {
      history = await prisma.watchHistory.findUnique({
        where: {
          userId_episodeId: {
            userId: user.id,
            episodeId: currentEpisode.id,
          },
        },
      });
      viewerSettings = normalizeSettings({
        theme: user.settings?.theme,
        reducedMotion: user.settings?.reducedMotion,
        neonEffects: user.settings?.neonEffects,
        showHistory: user.settings?.showHistory,
        autoplay: user.settings?.autoplay,
        resumePlayback: user.settings?.resumePlayback,
        publicProfile: !user.isPrivate,
        allowFollow: user.settings?.allowFollow,
        playbackSpeed: user.settings?.playbackSpeed,
        notifyAnnouncements: user.settings?.notifyAnnouncements,
        notifyEpisodes: user.settings?.notifyEpisodes,
        notifyFollowers: user.settings?.notifyFollowers,
        notifyReplies: user.settings?.notifyReplies,
      });
    }

    return NextResponse.json({
      anime: animeData,
      episode: currentEpisode,
      episodeId: currentEpisode.id,
      videoToPlay: resolvedVideoUrl || "",
      embedUrl: toEmbeddableVideoUrl(
        resolvedVideoUrl,
        resolvedSourceType,
      ),
      sources: safeSources,
      epTitle: `Episodio ${currentEpisode.number} - ${currentEpisode.title}`,
      playlist,
      nextEpisode,
      prevEpisode,
      history:
        viewerSettings.resumePlayback && resolvedSourceType === "direct"
          ? history
          : null,
      viewerSettings,
      sourceType: resolvedSourceType,
      isDirectSource: resolvedSourceType === "direct",
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
