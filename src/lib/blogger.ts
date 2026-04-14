import { normalizePlaybackUrl } from "@/lib/video";

type BloggerCacheEntry = {
  expiresAt: number;
  urls: string[];
};

type ResolveBloggerMediaUrlsOptions = {
  skipCache?: boolean;
  timeoutMs?: number;
};

const BLOGGER_HOST = "www.blogger.com";
const BLOGGER_RPC_ID = "WcwnYd";
const BLOGGER_CACHE_TTL_MS = 2 * 60 * 1000;
const BLOGGER_RPC_BASE =
  "https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute";
const BLOGGER_BROWSERINFO_BASE =
  "https://www.blogger.com/_/BloggerVideoPlayerUi/browserinfo";
const GLOBAL_CACHE_KEY = "__futuro_stream_blogger_media_cache__";
const BLOGGER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function getBloggerCache() {
  const scope = globalThis as unknown as Record<string, unknown>;
  const existing = scope[GLOBAL_CACHE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, BloggerCacheEntry>;
  }

  const created = new Map<string, BloggerCacheEntry>();
  scope[GLOBAL_CACHE_KEY] = created;
  return created;
}

function parseBloggerContext(html: string) {
  const sid = html.match(/"FdrFJe":"([^"]+)"/)?.[1] || "";
  const buildLabel = html.match(/"cfb2h":"([^"]+)"/)?.[1] || "";
  const language = html.match(/<html[^>]+lang="([^"]+)"/i)?.[1] || "en-US";

  return { sid, buildLabel, language };
}

function collectResponseCookies(response: Response) {
  const headersAny = response.headers as Headers & { getSetCookie?: () => string[] };
  const direct = typeof headersAny.getSetCookie === "function" ? headersAny.getSetCookie() : [];
  const fallback = String(response.headers.get("set-cookie") || "")
    .split(/,(?=[^;]+=[^;]+)/)
    .map((item) => item.trim())
    .filter(Boolean);

  const rawCookies = direct.length > 0 ? direct : fallback;
  if (!rawCookies.length) return "";

  const compact = rawCookies
    .map((item) => item.split(";")[0]?.trim() || "")
    .filter(Boolean);
  return compact.join("; ");
}

function buildBloggerHeaders(
  cookieHeader?: string,
  overrides?: Record<string, string>,
) {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    pragma: "no-cache",
    origin: `https://${BLOGGER_HOST}`,
    referer: `https://${BLOGGER_HOST}/`,
    "x-same-domain": "1",
    "user-agent": BLOGGER_USER_AGENT,
    ...(overrides || {}),
  };

  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  return headers;
}

async function fetchBloggerRpc(
  token: string,
  context: { sid: string; buildLabel: string; language: string },
  options: { timeoutMs: number; cookieHeader?: string },
) {
  const { sid, buildLabel, language } = context;
  const payload = JSON.stringify([
    [[BLOGGER_RPC_ID, JSON.stringify([token, null, 0]), null, "generic"]],
  ]);

  const rpcUrl = new URL(BLOGGER_RPC_BASE);
  rpcUrl.searchParams.set("rpcids", BLOGGER_RPC_ID);
  rpcUrl.searchParams.set("source-path", "/video.g");
  rpcUrl.searchParams.set("f.sid", sid);
  rpcUrl.searchParams.set("bl", buildLabel);
  rpcUrl.searchParams.set("hl", language);
  rpcUrl.searchParams.set(
    "_reqid",
    String(Math.floor(Math.random() * 90000) + 1000),
  );
  rpcUrl.searchParams.set("rt", "c");

  const rpcController = new AbortController();
  const rpcTimer = setTimeout(() => rpcController.abort(), options.timeoutMs);
  try {
    const rpcRes = await fetch(rpcUrl.toString(), {
      method: "POST",
      cache: "no-store",
      redirect: "follow",
      signal: rpcController.signal,
      headers: buildBloggerHeaders(options.cookieHeader, {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      }),
      body: `f.req=${encodeURIComponent(payload)}&`,
    });
    return await rpcRes.text();
  } catch {
    return "";
  } finally {
    clearTimeout(rpcTimer);
  }
}

async function sendBloggerBrowserInfo(
  context: { sid: string; buildLabel: string; language: string },
  options: { timeoutMs: number; cookieHeader?: string },
) {
  const { sid, buildLabel, language } = context;
  const browserInfoUrl = new URL(BLOGGER_BROWSERINFO_BASE);
  browserInfoUrl.searchParams.set("f.sid", sid);
  browserInfoUrl.searchParams.set("bl", buildLabel);
  browserInfoUrl.searchParams.set("hl", language);
  browserInfoUrl.searchParams.set(
    "_reqid",
    String(Math.floor(Math.random() * 900000) + 1000),
  );
  browserInfoUrl.searchParams.set("rt", "j");

  const body = "[9,1,1,[null,1080,1920],[null,953,1920],[1,1,null,1],[0,2,2]]";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    await fetch(browserInfoUrl.toString(), {
      method: "POST",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: buildBloggerHeaders(options.cookieHeader, {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      }),
      body: `f.req=${encodeURIComponent(body)}&`,
    });
  } catch {
    // ignore: this request is only a best-effort hint for batchexecute
  } finally {
    clearTimeout(timer);
  }
}

function decodeBloggerEscapedUrl(value: string) {
  const cleaned = String(value || "")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\u0025/g, "%")
    .replace(/\\\//g, "/")
    .replace(/\\=/g, "=")
    .replace(/\\&/g, "&")
    .replace(/\\,/g, ",")
    .replace(/&amp;/g, "&")
    .replace(/^"+|"+$/g, "")
    .replace(/[\\]+$/g, "")
    .replace(/[,\])}>]+$/g, "")
    .trim();

  return cleaned;
}

function normalizeBloggerMediaCandidates(responseText: string) {
  const normalizedText = String(responseText || "")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\u0025/g, "%")
    .replace(/\\\//g, "/")
    .replace(/\\=/g, "=")
    .replace(/\\&/g, "&");

  const rawMatches = [
    ...(normalizedText.match(/https:\/\/[^\s"'<>\\\]]+googlevideo\.com[^\s"'<>\\\]]+/g) || []),
    ...(normalizedText.match(/https:\\\/\\\/[^\s"'<>\\\]]+googlevideo\.com[^\s"'<>\\\]]+/g) || []),
  ];

  const urls = rawMatches
    .map((item) => decodeBloggerEscapedUrl(item))
    .map((item) => normalizePlaybackUrl(item))
    .filter(Boolean)
    .filter((item) => {
      try {
        return new URL(item).hostname.toLowerCase().includes("googlevideo.com");
      } catch {
        return false;
      }
    });

  const unique = Array.from(new Set(urls));
  const preferredItags = [22, 18, 37, 59];

  unique.sort((left, right) => {
    const leftItag = Number(new URL(left).searchParams.get("itag") || "0");
    const rightItag = Number(new URL(right).searchParams.get("itag") || "0");

    const leftIndex = preferredItags.indexOf(leftItag);
    const rightIndex = preferredItags.indexOf(rightItag);

    const leftScore = leftIndex >= 0 ? leftIndex : preferredItags.length + 1;
    const rightScore = rightIndex >= 0 ? rightIndex : preferredItags.length + 1;
    return leftScore - rightScore;
  });

  return unique;
}

export function extractBloggerToken(urlOrToken: string) {
  const value = String(urlOrToken || "").trim();
  if (!value) return "";

  if (!value.startsWith("http")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (!parsed.hostname.toLowerCase().includes("blogger.com")) return "";
    if (!parsed.pathname.toLowerCase().startsWith("/video.g")) return "";
    return String(parsed.searchParams.get("token") || "").trim();
  } catch {
    return "";
  }
}

export function isBloggerVideoGatewayUrl(url: string) {
  try {
    const parsed = new URL(normalizePlaybackUrl(url || ""));
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return host.includes("blogger.com") && pathname.startsWith("/video.g");
  } catch {
    return false;
  }
}

export async function resolveBloggerMediaUrls(
  urlOrToken: string,
  options?: ResolveBloggerMediaUrlsOptions,
) {
  const token = extractBloggerToken(urlOrToken);
  if (!token) return [] as string[];

  const timeoutMs = options?.timeoutMs ?? 12000;
  const cache = getBloggerCache();
  const now = Date.now();

  if (!options?.skipCache) {
    const cached = cache.get(token);
    if (cached && cached.expiresAt > now && cached.urls.length > 0) {
      return cached.urls;
    }
  }

  const pageUrl = new URL("https://www.blogger.com/video.g");
  pageUrl.searchParams.set("token", token);

  const pageController = new AbortController();
  const pageTimer = setTimeout(() => pageController.abort(), timeoutMs);
  let html = "";
  let cookieHeader = "";
  try {
    const pageRes = await fetch(pageUrl.toString(), {
      redirect: "follow",
      cache: "no-store",
      signal: pageController.signal,
      headers: {
        accept: "text/html,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent": BLOGGER_USER_AGENT,
      },
    });
    cookieHeader = collectResponseCookies(pageRes);
    html = await pageRes.text();
  } catch {
    clearTimeout(pageTimer);
    return [] as string[];
  }
  clearTimeout(pageTimer);

  const { sid, buildLabel, language } = parseBloggerContext(html);
  if (!sid || !buildLabel) return [] as string[];

  const context = { sid, buildLabel, language };
  let responseText = await fetchBloggerRpc(token, context, {
    timeoutMs,
    cookieHeader,
  });
  let urls = normalizeBloggerMediaCandidates(responseText);

  if (!urls.length) {
    await sendBloggerBrowserInfo(context, { timeoutMs, cookieHeader });
    responseText = await fetchBloggerRpc(token, context, {
      timeoutMs,
      cookieHeader,
    });
    urls = normalizeBloggerMediaCandidates(responseText);
  }

  if (urls.length > 0) {
    cache.set(token, {
      expiresAt: Date.now() + BLOGGER_CACHE_TTL_MS,
      urls,
    });
  }

  return urls;
}
