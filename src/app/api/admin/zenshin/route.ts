import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import { searchAnimeMetadataOptions } from "@/lib/anime-metadata";
import { findAnimeMediaOptionsByTitle } from "@/lib/mal";
import {
  fetchZenshinMapping,
  pickEpisodePreviewFromPool,
  resolveZenshinArtwork,
} from "@/lib/zenshin";

type LookupInput = {
  malId?: number;
  anilistId?: number;
  thetvdbId?: number;
  anidbId?: number;
};

type IdentifierCandidates = {
  malIds: number[];
  anilistIds: number[];
  thetvdbIds: number[];
  anidbIds: number[];
};

type AniListCandidate = {
  id: number;
  idMal?: number;
  title: string;
};

function asPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function pushUnique(list: number[], value: unknown) {
  const parsed = asPositiveInt(value);
  if (!parsed) return;
  if (!list.includes(parsed)) list.push(parsed);
}

function normalizeKey(value: string) {
  return String(value || "")
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

function mappingTitles(mapping: any) {
  const titles = [
    String(mapping?.title?.main || "").trim(),
    String(mapping?.title?.mainTitle || "").trim(),
    String(mapping?.title?.en || "").trim(),
    String(mapping?.title?.ja || "").trim(),
    String(mapping?.mainTitle || "").trim(),
  ].filter(Boolean);
  return Array.from(new Set(titles));
}

function scoreMappingMatch(query: string, mapping: any) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return 100;
  const titles = mappingTitles(mapping);
  if (!titles.length) return 0;
  return Math.max(...titles.map((title) => scoreTitleMatch(safeQuery, title)));
}

function parseIdsFromQuery(query: string) {
  const text = String(query || "").trim();
  const fromMalUrl = asPositiveInt(text.match(/myanimelist\.net\/anime\/(\d+)/i)?.[1]);
  const fromAniListUrl = asPositiveInt(text.match(/anilist\.co\/anime\/(\d+)/i)?.[1]);
  const fromMalTag = asPositiveInt(text.match(/(?:^|\b)mal(?:_?id)?\s*[:=#-]?\s*(\d{1,9})/i)?.[1]);
  const fromAniListTag = asPositiveInt(text.match(/(?:^|\b)anilist(?:_?id)?\s*[:=#-]?\s*(\d{1,9})/i)?.[1]);
  const plainNumeric = /^\d{1,9}$/.test(text) ?asPositiveInt(text) : 0;

  return {
    malId: fromMalUrl || fromMalTag || plainNumeric || 0,
    anilistId: fromAniListUrl || fromAniListTag || 0,
  };
}

async function searchAniListByTitle(query: string, limit = 8): Promise<AniListCandidate[]> {
  const safeQuery = String(query || "").trim();
  if (safeQuery.length < 2) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query ($search: String, $perPage: Int) {
            Page(page: 1, perPage: $perPage) {
              media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
                id
                idMal
                title {
                  romaji
                  english
                  native
                }
              }
            }
          }
        `,
        variables: { search: safeQuery, perPage: Math.max(1, Math.min(15, limit)) },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const payload = await response.json();
    const media = Array.isArray(payload?.data?.Page?.media) ?payload.data.Page.media : [];

    const mapped = media
      .map((item: any) => {
        const romaji = String(item?.title?.romaji || "").trim();
        const english = String(item?.title?.english || "").trim();
        const native = String(item?.title?.native || "").trim();
        const title = romaji || english || native || "";
        return {
          id: asPositiveInt(item?.id),
          idMal: asPositiveInt(item?.idMal) || undefined,
          title,
          __score: Math.max(
            scoreTitleMatch(safeQuery, romaji),
            scoreTitleMatch(safeQuery, english),
            scoreTitleMatch(safeQuery, native),
            scoreTitleMatch(safeQuery, title),
          ),
        };
      })
      .filter((item: any) => item.id > 0 && item.title);

    return mapped
      .sort((a: any, b: any) => b.__score - a.__score)
      .map(({ __score, ...item }: any) => item)
      .slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function buildIdentifierCandidates(query: string, explicit: IdentifierCandidates) {
  const candidates: IdentifierCandidates = {
    malIds: [...explicit.malIds],
    anilistIds: [...explicit.anilistIds],
    thetvdbIds: [...explicit.thetvdbIds],
    anidbIds: [...explicit.anidbIds],
  };

  const safeQuery = String(query || "").trim();
  if (!safeQuery) return candidates;

  const parsed = parseIdsFromQuery(safeQuery);
  pushUnique(candidates.malIds, parsed.malId);
  pushUnique(candidates.anilistIds, parsed.anilistId);

  const metadataOptions = await searchAnimeMetadataOptions(safeQuery, 12).catch(() => []);
  const sortedOptions = metadataOptions
    .slice()
    .sort(
      (a, b) =>
        scoreTitleMatch(safeQuery, String(b.matchedTitle || "")) -
        scoreTitleMatch(safeQuery, String(a.matchedTitle || "")),
    );
  for (const option of sortedOptions) {
    pushUnique(candidates.malIds, option.malId);
    if (candidates.malIds.length >= 8) break;
  }

  if (!candidates.malIds.length) {
    const malRows = await findAnimeMediaOptionsByTitle(safeQuery, 8).catch(() => []);
    for (const row of malRows
      .slice()
      .sort((a, b) => scoreTitleMatch(safeQuery, b.title) - scoreTitleMatch(safeQuery, a.title))) {
      pushUnique(candidates.malIds, row.malId);
      if (candidates.malIds.length >= 6) break;
    }
  }

  if (!candidates.anilistIds.length || !candidates.malIds.length) {
    const anilistRows = await searchAniListByTitle(safeQuery, 8);
    for (const row of anilistRows) {
      pushUnique(candidates.anilistIds, row.id);
      pushUnique(candidates.malIds, row.idMal);
      if (candidates.anilistIds.length >= 6 && candidates.malIds.length >= 6) break;
    }
  }

  return candidates;
}

function buildLookupQueue(candidates: IdentifierCandidates): LookupInput[] {
  const queue: LookupInput[] = [];
  const pushLookup = (lookup: LookupInput) => {
    const key = `${lookup.malId || 0}:${lookup.anilistId || 0}:${lookup.thetvdbId || 0}:${lookup.anidbId || 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      queue.push(lookup);
    }
  };

  const seen = new Set<string>();
  const firstMal = candidates.malIds[0] || 0;
  const firstAniList = candidates.anilistIds[0] || 0;
  if (firstMal && firstAniList) {
    pushLookup({ malId: firstMal, anilistId: firstAniList });
  }

  for (const malId of candidates.malIds) {
    pushLookup({ malId });
  }
  for (const anilistId of candidates.anilistIds) {
    pushLookup({ anilistId });
  }
  for (const thetvdbId of candidates.thetvdbIds) {
    pushLookup({ thetvdbId });
  }
  for (const anidbId of candidates.anidbIds) {
    pushLookup({ anidbId });
  }

  return queue;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  const explicit: IdentifierCandidates = {
    malIds: [asPositiveInt(req.nextUrl.searchParams.get("mal_id"))].filter(Boolean),
    anilistIds: [asPositiveInt(req.nextUrl.searchParams.get("anilist_id"))].filter(Boolean),
    thetvdbIds: [asPositiveInt(req.nextUrl.searchParams.get("thetvdb_id"))].filter(Boolean),
    anidbIds: [asPositiveInt(req.nextUrl.searchParams.get("anidb_id"))].filter(Boolean),
  };

  const hasExplicitIds =
    explicit.malIds.length > 0 ||
    explicit.anilistIds.length > 0 ||
    explicit.thetvdbIds.length > 0 ||
    explicit.anidbIds.length > 0;

  if (!hasExplicitIds && q.length < 2) {
    return NextResponse.json(
      { error: "Informe q (min 2 chars) ou um id (mal_id/anilist_id/thetvdb_id/anidb_id)." },
      { status: 400 },
    );
  }

  const candidates = await buildIdentifierCandidates(q, explicit);
  const queue = buildLookupQueue(candidates);
  if (!queue.length) {
    return NextResponse.json(
      {
        error: "Não foi possível resolver um identificador para Zenshin.",
        hint: "Tente informar um MAL ID/URL ou o título oficial do anime.",
      },
      { status: 404 },
    );
  }

  let resolvedLookup: LookupInput | null = null;
  let mapping: any = null;
  let mappingScore = -1;
  const safeQuery = String(q || "").trim();
  const maxLookups = hasExplicitIds ?Math.min(18, queue.length) : Math.min(12, queue.length);

  for (const lookup of queue.slice(0, maxLookups)) {
    const current = await fetchZenshinMapping(lookup);
    if (!current) continue;
    const score = scoreMappingMatch(safeQuery, current);

    if (!mapping || score > mappingScore) {
      resolvedLookup = lookup;
      mapping = current;
      mappingScore = score;
    }

    if (score >= 100) break;
  }

  if (!mapping) {
    return NextResponse.json({ error: "Nenhum mapeamento encontrado na Zenshin API." }, { status: 404 });
  }

  // Mantém o fluxo do painel funcionando mesmo com confiança baixa, mas sinaliza risco.
  const lowConfidence = !hasExplicitIds && Boolean(safeQuery) && mappingScore < 28;

  const rawMappings = (mapping?.mappings || {}) as Record<string, unknown>;
  const resolvedMalId =
    asPositiveInt(resolvedLookup?.malId) ||
    asPositiveInt(rawMappings.mal_id);
  const resolvedAniListId =
    asPositiveInt(resolvedLookup?.anilistId) ||
    asPositiveInt(rawMappings.anilist_id);
  const resolvedTvdbId =
    asPositiveInt(resolvedLookup?.thetvdbId) ||
    asPositiveInt(rawMappings.thetvdb_id) ||
    asPositiveInt(rawMappings.tvdb_id);
  const resolvedAnidbId =
    asPositiveInt(resolvedLookup?.anidbId) ||
    asPositiveInt(rawMappings.anidb_id);

  const artwork = await resolveZenshinArtwork(mapping);
  const randomEpisodePreview =
    pickEpisodePreviewFromPool(
      artwork.episodeImages,
      Math.max(1, Math.floor(Math.random() * Math.max(1, artwork.episodeImages.length))),
      `${resolvedMalId}:${resolvedAniListId}:${q.toLowerCase()}`,
    ) || "";

  return NextResponse.json({
    ok: true,
    lowConfidence,
    warning: lowConfidence
      ?"Correspondência com baixa confiança. Confira título/capa/banner antes de salvar."
      : null,
    match: {
      malId: resolvedMalId || null,
      anilistId: resolvedAniListId || null,
      thetvdbId: resolvedTvdbId || null,
      anidbId: resolvedAnidbId || null,
    },
    confidence: mappingScore >= 0 ?mappingScore : null,
    mapping,
    artwork: {
      coverImage: artwork.coverImage || null,
      bannerImage: artwork.bannerImage || null,
      tmdbCoverImage: artwork.tmdbCoverImage || null,
      tmdbBannerImage: artwork.tmdbBannerImage || null,
    },
    episodePreview: {
      random: randomEpisodePreview || null,
      totalWithImage: artwork.episodeImages.length,
      byEpisode: artwork.episodeImagesByNumber,
    },
  });
}
