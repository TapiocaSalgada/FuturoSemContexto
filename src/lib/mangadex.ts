import { createHmac, timingSafeEqual } from "node:crypto";

const MANGADEX_API = "https://api.mangadex.org";
const MANGADEX_NETWORK_REPORT_API = "https://api.mangadex.network/report";
const MANGADEX_USER_AGENT =
  process.env.MANGADEX_USER_AGENT?.trim() ||
  "FuturoStream/1.0 (+https://futuro-stream.app)";

const MANGADEX_PROXY_FALLBACK_SECRET = "futuro-stream-mangadex-dev-only";
const MANGADEX_PROXY_TOKEN_TTL_SECONDS = 15 * 60;
const MAX_RETRY_ATTEMPTS = 3;

type MdQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

type MdFetchOptions = {
  retries?: number;
  revalidateSeconds?: number;
  cache?: RequestCache;
  noStore?: boolean;
  headers?: HeadersInit;
  method?: "GET" | "POST";
  body?: BodyInit;
};

type MangaDexImageTokenPayload = {
  chapterId: string;
  sourceUrl: string;
  exp: number;
};

type MangaDexAtHomeResponse = {
  baseUrl?: string;
  chapter?: {
    hash?: string;
    data?: string[];
    dataSaver?: string[];
  };
};

type MangaDexFeedResponse = {
  data?: any[];
  total?: number;
};

export type MangaDexAtHomeServer = {
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
};

export class MangaDexApiError extends Error {
  status: number;
  url: string;
  retryAfterMs: number | null;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    url: string,
    retryAfterMs: number | null = null,
    details?: unknown,
  ) {
    super(message);
    this.name = "MangaDexApiError";
    this.status = status;
    this.url = url;
    this.retryAfterMs = retryAfterMs;
    this.details = details;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildMdUrl(path: string, query?: Record<string, MdQueryValue>) {
  const url = new URL(path.startsWith("http") ? path : `${MANGADEX_API}${path.startsWith("/") ? "" : "/"}${path}`);

  if (!query) return url.toString();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .forEach((item) => url.searchParams.append(key, item));
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) {
    const ms = asDate - Date.now();
    return ms > 0 ? ms : null;
  }

  return null;
}

function buildRetryDelayMs(attempt: number, retryAfterMs: number | null) {
  const fallback = Math.pow(2, attempt) * 700 + Math.random() * 400;
  if (!retryAfterMs) return fallback;
  return clampNumber(retryAfterMs + Math.random() * 250, 250, 12_000);
}

function shouldRetryStatus(status: number) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function parseMaybeJson(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function mdFetchJson<T>(path: string, options: MdFetchOptions = {}): Promise<T> {
  const {
    retries = MAX_RETRY_ATTEMPTS,
    revalidateSeconds = 1800,
    noStore = false,
    cache,
    headers,
    method = "GET",
    body,
  } = options;

  const url = buildMdUrl(path);
  const maxRetries = clampNumber(Math.floor(Number(retries) || 0), 0, 6);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const requestInit: RequestInit & { next?: { revalidate: number } } = {
        method,
        headers: {
          Accept: "application/json",
          "User-Agent": MANGADEX_USER_AGENT,
          ...(headers || {}),
        },
      };

      if (noStore) {
        requestInit.cache = "no-store";
      } else {
        requestInit.cache = cache || "force-cache";
        requestInit.next = { revalidate: revalidateSeconds };
      }

      if (body !== undefined) {
        requestInit.body = body;
      }

      const response = await fetch(url, requestInit);

      if (response.ok) {
        const text = await response.text();
        if (!text) return {} as T;

        const payload = parseMaybeJson(text);
        if (payload === null || typeof payload !== "object") {
          throw new MangaDexApiError(
            "Resposta invalida da MangaDex API.",
            response.status,
            url,
            null,
            text,
          );
        }

        return payload as T;
      }

      const retryAfterMs =
        parseRetryAfterMs(response.headers.get("retry-after")) ||
        parseRetryAfterMs(response.headers.get("x-ratelimit-retry-after"));
      const detailsText = await response.text();
      const details = parseMaybeJson(detailsText);
      const isRetryable = shouldRetryStatus(response.status);

      if (isRetryable && attempt < maxRetries) {
        await sleep(buildRetryDelayMs(attempt, retryAfterMs));
        continue;
      }

      throw new MangaDexApiError(
        `MangaDex API retornou ${response.status}.`,
        response.status,
        url,
        retryAfterMs,
        details,
      );
    } catch (error) {
      if (error instanceof MangaDexApiError) {
        throw error;
      }

      if (attempt < maxRetries) {
        await sleep(buildRetryDelayMs(attempt, null));
        continue;
      }

      throw new MangaDexApiError(
        "Falha de rede ao acessar MangaDex API.",
        0,
        url,
        null,
        error,
      );
    }
  }

  throw new MangaDexApiError("MangaDex API: tentativas esgotadas.", 0, buildMdUrl(path));
}

// ── Types ──────────────────────────────────────────────

export type MangaDexSearchResult = {
  id: string;
  title: string;
  altTitles?: string[];
  description?: string;
  coverUrl?: string;
  coverUrlHD?: string;
  status?: string;
  year?: number;
  contentRating?: string;
  lastChapter?: string;
  lastVolume?: string;
  tags?: string[];
  demographics?: string[];
  originalLanguage?: string;
  availableLanguages?: string[];
};

export type MangaDexChapter = {
  id: string;
  chapterNumber: number | null;
  volumeNumber: number | null;
  title: string | null;
  language: string;
  pages: number;
  scanlationTeam: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
};

export type MangaDexChapterPages = {
  baseUrl: string;
  hash: string;
  pages: string[];
  pagesHQ: string[];
};

export type MangaDexNetworkReportInput = {
  url: string;
  success: boolean;
  bytes?: number;
  durationMs: number;
  cached?: boolean;
};

// ── Helpers ────────────────────────────────────────────

function extractTitle(attributes: any): string {
  const titles = attributes?.title || {};
  return (
    titles.en ||
    titles["ja-ro"] ||
    titles.ja ||
    titles["pt-br"] ||
    Object.values(titles)[0] ||
    "Sem título"
  ) as string;
}

function extractDescription(attributes: any, lang = "en"): string {
  const desc = attributes?.description || {};
  return (desc[lang] || desc["pt-br"] || desc.en || Object.values(desc)[0] || "") as string;
}

function extractCoverFileName(relationships: any[]): string | null {
  if (!Array.isArray(relationships)) return null;
  const cover = relationships.find((r: any) => r.type === "cover_art");
  return cover?.attributes?.fileName || null;
}

function buildCoverUrl(mangaId: string, fileName: string | null, size: "256" | "512" = "512"): string | undefined {
  if (!fileName) return undefined;
  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`;
}

function extractTags(attributes: any): string[] {
  if (!attributes?.tags || !Array.isArray(attributes.tags)) return [];
  return attributes.tags
    .filter((t: any) => t.attributes?.group === "genre" || t.attributes?.group === "theme")
    .map((t: any) => {
      const names = t.attributes?.name || {};
      return (names.en || names["pt-br"] || Object.values(names)[0] || "") as string;
    })
    .filter(Boolean);
}

function extractDemographics(attributes: any): string[] {
  if (!attributes?.tags || !Array.isArray(attributes.tags)) return [];
  return attributes.tags
    .filter((t: any) => t.attributes?.group === "demographic")
    .map((t: any) => {
      const names = t.attributes?.name || {};
      return (names.en || Object.values(names)[0] || "") as string;
    })
    .filter(Boolean);
}

function extractScanlationTeam(relationships: any[]): string | null {
  if (!Array.isArray(relationships)) return null;
  const group = relationships.find((r: any) => r.type === "scanlation_group");
  return group?.attributes?.name || null;
}

function normalizeTranslatedLanguages(language: string) {
  const base = String(language || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const fallback = base.length > 0 ? base : ["pt-br"];
  if (fallback.includes("pt-br") && !fallback.includes("en")) {
    fallback.push("en");
  }

  return Array.from(new Set(fallback));
}

function parseChapterNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function createChapterDedupKey(item: any) {
  const attrs = item?.attributes || {};
  const rawChapter = String(attrs.chapter || "").trim();
  const rawVolume = String(attrs.volume || "").trim();

  if (rawChapter) {
    if (rawVolume) {
      return `volume:${rawVolume}|chapter:${rawChapter}`;
    }

    return `chapter:${rawChapter}`;
  }

  const id = String(item?.id || "").trim();
  return id ? `id:${id}` : "";
}

function mapChapterItem(item: any, fallbackLanguage: string): MangaDexChapter | null {
  const attrs = item?.attributes || {};
  const id = String(item?.id || "").trim();
  if (!id) return null;

  const chapterLanguage = String(attrs.translatedLanguage || "").trim().toLowerCase();

  return {
    id,
    chapterNumber: parseChapterNumber(attrs.chapter),
    volumeNumber: Number.isFinite(Number(attrs.volume)) ? Number(attrs.volume) : null,
    title: attrs.title || null,
    language: chapterLanguage || fallbackLanguage,
    pages: Number.isFinite(Number(attrs.pages)) ? Number(attrs.pages) : 0,
    scanlationTeam: extractScanlationTeam(item.relationships),
    publishedAt: attrs.publishAt || attrs.createdAt || null,
    externalUrl: attrs.externalUrl || null,
  };
}

function shouldReplaceChapter(
  current: MangaDexChapter,
  incoming: MangaDexChapter,
  langPreference: string[],
) {
  const currentRank = getLanguageRank(current.language, langPreference);
  const nextRank = getLanguageRank(incoming.language, langPreference);

  if (nextRank !== currentRank) {
    return nextRank < currentRank;
  }

  return (incoming.pages || 0) > (current.pages || 0);
}

function sortChapters(chapters: MangaDexChapter[]) {
  chapters.sort((a, b) => {
    if (a.chapterNumber === null && b.chapterNumber === null) return a.id.localeCompare(b.id);
    if (a.chapterNumber === null) return 1;
    if (b.chapterNumber === null) return -1;
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    return a.id.localeCompare(b.id);
  });

  return chapters;
}

function mergeChapterItems(
  deduped: Map<string, MangaDexChapter>,
  items: any[],
  fallbackLanguage: string,
  langPreference: string[],
) {
  for (const item of items) {
    const mapped = mapChapterItem(item, fallbackLanguage);
    if (!mapped) continue;

    const dedupeKey = createChapterDedupKey(item);
    if (!dedupeKey) continue;

    const current = deduped.get(dedupeKey);
    if (!current || shouldReplaceChapter(current, mapped, langPreference)) {
      deduped.set(dedupeKey, mapped);
    }
  }
}

async function fetchMangaDexFeedPage(input: {
  mangaId: string;
  languages: string[];
  limit: number;
  offset: number;
}) {
  const data = await mdFetchJson<MangaDexFeedResponse>(
    buildMdUrl(`/manga/${encodeURIComponent(input.mangaId)}/feed`, {
      "translatedLanguage[]": input.languages,
      limit: clampNumber(Math.floor(input.limit || 100), 1, 500),
      offset: Math.max(0, Math.floor(input.offset || 0)),
      "order[chapter]": "asc",
      "includes[]": ["scanlation_group"],
      includeFuturePublishAt: false,
    }),
  );

  return {
    items: Array.isArray(data?.data) ? data.data : [],
    total: Number.isFinite(Number(data?.total)) ? Number(data?.total) : 0,
  };
}

function getLanguageRank(language: string | null, preference: string[]) {
  if (!language) return Number.MAX_SAFE_INTEGER;
  const idx = preference.indexOf(language.toLowerCase());
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

function getProxySecret() {
  return (
    process.env.MANGADEX_PROXY_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    MANGADEX_PROXY_FALLBACK_SECRET
  );
}

function signTokenPayload(payloadEncoded: string) {
  return createHmac("sha256", getProxySecret())
    .update(payloadEncoded)
    .digest("base64url");
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isAllowedMangaDexImageUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  const protocol = url.protocol.toLowerCase();
  const path = url.pathname.toLowerCase();

  const allowedHost =
    host === "uploads.mangadex.org" ||
    host.endsWith(".mangadex.network") ||
    host.endsWith(".mangadex.org");

  if (!allowedHost || protocol !== "https:") {
    return false;
  }

  return path.includes("/data/") || path.includes("/data-saver/");
}

export function buildMangaDexSourceImageUrl(
  baseUrl: string,
  folder: "data" | "data-saver",
  hash: string,
  fileName: string,
) {
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedHash = String(hash || "").trim();
  const normalizedFile = String(fileName || "").trim();

  if (!normalizedBase || !normalizedHash || !normalizedFile) {
    return "";
  }

  return `${normalizedBase}/${folder}/${normalizedHash}/${encodeURIComponent(normalizedFile)}`;
}

export function createMangaDexImageToken(input: {
  chapterId: string;
  sourceUrl: string;
  ttlSeconds?: number;
}) {
  const chapterId = String(input.chapterId || "").trim();
  const sourceUrl = String(input.sourceUrl || "").trim();
  if (!chapterId || !sourceUrl) return null;

  const parsed = safeParseUrl(sourceUrl);
  if (!parsed || !isAllowedMangaDexImageUrl(parsed)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = clampNumber(
    Math.floor(Number(input.ttlSeconds) || MANGADEX_PROXY_TOKEN_TTL_SECONDS),
    45,
    3600,
  );

  const payload: MangaDexImageTokenPayload = {
    chapterId,
    sourceUrl: parsed.toString(),
    exp: now + ttlSeconds,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyMangaDexImageToken(token: string, expectedChapterId: string) {
  const rawToken = String(token || "").trim();
  const chapterId = String(expectedChapterId || "").trim();
  if (!rawToken || !chapterId) return null;

  const [encodedPayload, signature] = rawToken.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  const providedSignature = Buffer.from(signature, "utf8");
  const normalizedExpectedSignature = Buffer.from(expectedSignature, "utf8");

  if (providedSignature.length !== normalizedExpectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, normalizedExpectedSignature)) {
    return null;
  }

  let payload: MangaDexImageTokenPayload;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || payload.chapterId !== chapterId) {
    return null;
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const parsed = safeParseUrl(payload.sourceUrl);
  if (!parsed || !isAllowedMangaDexImageUrl(parsed)) {
    return null;
  }

  return parsed.toString();
}

export function buildMangaDexProxyImageUrls(input: {
  chapterId: string;
  sourceUrls: string[];
  ttlSeconds?: number;
}) {
  const chapterId = String(input.chapterId || "").trim();
  if (!chapterId) return [];

  return input.sourceUrls
    .map((sourceUrl) =>
      createMangaDexImageToken({
        chapterId,
        sourceUrl,
        ttlSeconds: input.ttlSeconds,
      }),
    )
    .filter((token): token is string => Boolean(token))
    .map(
      (token) =>
        `/api/mangas/chapter/${encodeURIComponent(chapterId)}/image?token=${encodeURIComponent(token)}`,
    );
}

export async function reportMangaDexNetworkResult(input: MangaDexNetworkReportInput) {
  const targetUrl = String(input.url || "").trim();
  if (!targetUrl) return;

  const parsed = safeParseUrl(targetUrl);
  if (!parsed || !isAllowedMangaDexImageUrl(parsed)) return;

  const body = [
    {
      url: parsed.toString(),
      success: Boolean(input.success),
      bytes: Math.max(0, Math.floor(Number(input.bytes) || 0)),
      duration: Math.max(0, Math.floor(Number(input.durationMs) || 0)),
      cached: Boolean(input.cached),
    },
  ];

  try {
    await fetch(MANGADEX_NETWORK_REPORT_API, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": MANGADEX_USER_AGENT,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // best effort
  }
}

export async function getMangaDexAtHomeServer(
  chapterId: string,
): Promise<MangaDexAtHomeServer | null> {
  const normalizedChapterId = String(chapterId || "").trim();
  if (!normalizedChapterId) return null;

  const data = await mdFetchJson<MangaDexAtHomeResponse>(
    buildMdUrl(`/at-home/server/${encodeURIComponent(normalizedChapterId)}`, {
      forcePort443: true,
    }),
    {
      noStore: true,
      retries: 2,
    },
  );

  const baseUrl = String(data?.baseUrl || "").replace(/\/+$/, "");
  const hash = String(data?.chapter?.hash || "").trim();
  const fileList = Array.isArray(data?.chapter?.data)
    ? data.chapter!.data.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const saverFileList = Array.isArray(data?.chapter?.dataSaver)
    ? data.chapter!.dataSaver.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!baseUrl || !hash || fileList.length === 0) {
    return null;
  }

  return {
    baseUrl,
    hash,
    data: fileList,
    dataSaver: saverFileList,
  };
}

// ── Search ─────────────────────────────────────────────

/**
 * Search manga on MangaDex
 */
export async function searchMangaDex(
  query: string,
  limit = 10,
  offset = 0,
): Promise<MangaDexSearchResult[]> {
  if (!query || !query.trim()) return [];

  const data = await mdFetchJson<{ data?: any[] }>(
    buildMdUrl("/manga", {
      title: query.trim(),
      limit: clampNumber(Math.floor(limit || 10), 1, 100),
      offset: Math.max(0, Math.floor(offset || 0)),
      "includes[]": ["cover_art"],
      "contentRating[]": ["safe", "suggestive"],
      "order[relevance]": "desc",
    }),
  );

  if (!data?.data || !Array.isArray(data.data)) return [];

  return data.data.map((item: any) => {
    const attrs = item.attributes;
    const coverFile = extractCoverFileName(item.relationships);

    return {
      id: item.id,
      title: extractTitle(attrs),
      altTitles: (attrs.altTitles || [])
        .map((t: any) => Object.values(t)[0])
        .filter(Boolean)
        .slice(0, 5),
      description: extractDescription(attrs),
      coverUrl: buildCoverUrl(item.id, coverFile, "256"),
      coverUrlHD: buildCoverUrl(item.id, coverFile, "512"),
      status: attrs.status || undefined,
      year: attrs.year || undefined,
      contentRating: attrs.contentRating || undefined,
      lastChapter: attrs.lastChapter || undefined,
      lastVolume: attrs.lastVolume || undefined,
      tags: extractTags(attrs),
      demographics: extractDemographics(attrs),
      originalLanguage: attrs.originalLanguage || undefined,
      availableLanguages: attrs.availableTranslatedLanguages || undefined,
    } as MangaDexSearchResult;
  });
}

/**
 * Get manga details by MangaDex ID
 */
export async function getMangaDexById(
  mangaId: string,
): Promise<MangaDexSearchResult | null> {
  if (!mangaId) return null;

  let data: { data?: any };

  try {
    data = await mdFetchJson<{ data?: any }>(
      buildMdUrl(`/manga/${encodeURIComponent(mangaId)}`, {
        "includes[]": ["cover_art"],
      }),
    );
  } catch (error) {
    if (error instanceof MangaDexApiError && error.status === 404) {
      return null;
    }

    throw error;
  }

  if (!data?.data) return null;

  const item = data.data;
  const attrs = item.attributes;
  const coverFile = extractCoverFileName(item.relationships);

  return {
    id: item.id,
    title: extractTitle(attrs),
    altTitles: (attrs.altTitles || [])
      .map((t: any) => Object.values(t)[0])
      .filter(Boolean)
      .slice(0, 5),
    description: extractDescription(attrs),
    coverUrl: buildCoverUrl(item.id, coverFile, "256"),
    coverUrlHD: buildCoverUrl(item.id, coverFile, "512"),
    status: attrs.status || undefined,
    year: attrs.year || undefined,
    contentRating: attrs.contentRating || undefined,
    lastChapter: attrs.lastChapter || undefined,
    lastVolume: attrs.lastVolume || undefined,
    tags: extractTags(attrs),
    demographics: extractDemographics(attrs),
    originalLanguage: attrs.originalLanguage || undefined,
    availableLanguages: attrs.availableTranslatedLanguages || undefined,
  };
}

/**
 * Get chapters for a manga, with pagination, ordered by chapter number
 */
export async function getMangaDexChapters(
  mangaId: string,
  language = "pt-br",
  limit = 100,
  offset = 0,
): Promise<{ chapters: MangaDexChapter[]; total: number }> {
  if (!mangaId) return { chapters: [], total: 0 };

  const languages = normalizeTranslatedLanguages(language);
  const { items, total } = await fetchMangaDexFeedPage({
    mangaId,
    languages,
    limit,
    offset,
  });

  if (items.length === 0) return { chapters: [], total };

  const deduped = new Map<string, MangaDexChapter>();
  mergeChapterItems(deduped, items, language, languages);

  return {
    chapters: sortChapters([...deduped.values()]),
    total: total || deduped.size,
  };
}

export async function getAllMangaDexChapters(
  mangaId: string,
  language = "pt-br",
): Promise<{ chapters: MangaDexChapter[]; total: number; pagesFetched: number }> {
  if (!mangaId) return { chapters: [], total: 0, pagesFetched: 0 };

  const perPage = 500;
  const maxPages = 30;
  const languages = normalizeTranslatedLanguages(language);
  const deduped = new Map<string, MangaDexChapter>();

  let offset = 0;
  let total = 0;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const page = await fetchMangaDexFeedPage({
      mangaId,
      languages,
      limit: perPage,
      offset,
    });

    pagesFetched += 1;
    total = page.total || total;

    if (page.items.length === 0) {
      break;
    }

    mergeChapterItems(deduped, page.items, language, languages);

    offset += perPage;
    if (total > 0 && offset >= total) {
      break;
    }

    if (page.items.length < perPage) {
      break;
    }
  }

  const chapters = sortChapters([...deduped.values()]);

  return {
    chapters,
    total: total || chapters.length,
    pagesFetched,
  };
}

/**
 * Get chapter pages for inline reader
 */
export async function fetchChapterPages(
  chapterId: string,
): Promise<MangaDexChapterPages | null> {
  if (!chapterId) return null;

  const atHome = await getMangaDexAtHomeServer(chapterId);
  if (!atHome) return null;

  return {
    baseUrl: atHome.baseUrl,
    hash: atHome.hash,
    pagesHQ: atHome.data.map((fileName) =>
      buildMangaDexSourceImageUrl(atHome.baseUrl, "data", atHome.hash, fileName),
    ),
    pages: (atHome.dataSaver.length > 0 ? atHome.dataSaver : atHome.data).map((fileName) =>
      buildMangaDexSourceImageUrl(atHome.baseUrl, "data-saver", atHome.hash, fileName),
    ),
  };
}

/**
 * Get popular manga from MangaDex
 */
export async function getPopularManga(
  limit = 10,
): Promise<MangaDexSearchResult[]> {
  const data = await mdFetchJson<{ data?: any[] }>(
    buildMdUrl("/manga", {
      limit: clampNumber(Math.floor(limit || 10), 1, 30),
      "includes[]": ["cover_art"],
      "contentRating[]": ["safe", "suggestive"],
      "order[followedCount]": "desc",
      "availableTranslatedLanguage[]": ["pt-br", "en"],
    }),
  );

  if (!data?.data || !Array.isArray(data.data)) return [];

  return data.data.map((item: any) => {
    const attrs = item.attributes;
    const coverFile = extractCoverFileName(item.relationships);
    return {
      id: item.id,
      title: extractTitle(attrs),
      description: extractDescription(attrs),
      coverUrl: buildCoverUrl(item.id, coverFile, "256"),
      coverUrlHD: buildCoverUrl(item.id, coverFile, "512"),
      status: attrs.status || undefined,
      year: attrs.year || undefined,
      tags: extractTags(attrs),
    } as MangaDexSearchResult;
  });
}
