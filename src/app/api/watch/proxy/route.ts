import { NextResponse } from "next/server";

import {
  isBloggerVideoGatewayUrl,
  resolveBloggerMediaUrls,
} from "@/lib/blogger";
import { normalizePlaybackUrl } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOST_HINTS = [
  "blogger.com",
  "blogspot.com",
  "googlevideo.com",
  "drive.google.com",
  "drive.usercontent.google.com",
  "storage.googleapis.com",
  "akamaized.net",
  "cloudfront.net",
  "bunnycdn",
  "wasabisys.com",
  "backblazeb2.com",
];

function isAllowedHost(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOST_HINTS.some((hint) => host.includes(hint));
  } catch {
    return false;
  }
}

function cloneMediaHeaders(upstream: Response) {
  const headers = new Headers();
  const allowed = new Set([
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
    "expires",
  ]);

  for (const [key, value] of upstream.headers.entries()) {
    if (allowed.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  headers.set("Cache-Control", "no-store");
  if (!headers.get("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  return headers;
}

function resolveUpstreamReferer(sourceUrl: string, request: Request) {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    if (host.includes("googlevideo.com") || host.includes("blogger.com") || host.includes("blogspot.com")) {
      return "https://www.blogger.com/";
    }
    if (host.includes("drive.google.com") || host.includes("drive.usercontent.google.com")) {
      return "https://drive.google.com/";
    }
  } catch {
    // ignore and fallback below
  }

  return `${new URL(request.url).origin}/`;
}

async function fetchMedia(sourceUrl: string, request: Request) {
  const headers = new Headers({
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    // Avoid custom UA tokens: googlevideo can reject non-browser-like signatures.
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    referer: resolveUpstreamReferer(sourceUrl, request),
  });

  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  return fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers,
  });
}

async function resolvePlayableSources(sourceUrl: string, refresh = false) {
  if (!isBloggerVideoGatewayUrl(sourceUrl)) {
    return [sourceUrl];
  }

  const resolved = await resolveBloggerMediaUrls(sourceUrl, {
    skipCache: refresh,
    timeoutMs: 10000,
  });

  return resolved;
}

async function fetchFirstPlayableSource(
  candidates: string[],
  request: Request,
) {
  let lastStatus = 0;
  let lastContentType = "";
  let lastUpstream: Response | null = null;
  const attempts: { url: string; status: number; contentType: string; blocked: boolean }[] = [];

  for (const candidate of candidates) {
    if (!candidate || !isAllowedHost(candidate)) continue;
    const upstream = await fetchMedia(candidate, request).catch(() => null);
    const status = upstream?.status || 0;
    const contentType = (upstream?.headers.get("content-type") || "").toLowerCase();
    const blocked = !upstream || !upstream.ok || contentType.includes("text/html");
    attempts.push({ url: candidate, status, contentType, blocked });

    lastStatus = status || lastStatus;
    lastContentType = contentType || lastContentType;
    lastUpstream = upstream || lastUpstream;

    if (!blocked && upstream?.body) {
      return {
        upstream,
        status,
        contentType,
        attempts,
      };
    }
  }

  return {
    upstream: lastUpstream,
    status: lastStatus,
    contentType: lastContentType,
    attempts,
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const debug = requestUrl.searchParams.get("debug") === "1";
  const rawSource = String(requestUrl.searchParams.get("src") || "").trim();
  if (!rawSource) {
    return NextResponse.json(
      { error: "Parametro src obrigatorio." },
      { status: 400 },
    );
  }

  const sourceUrl = normalizePlaybackUrl(rawSource);
  if (!sourceUrl.startsWith("http")) {
    return NextResponse.json(
      { error: "Formato de fonte inválido." },
      { status: 400 },
    );
  }

  if (!isAllowedHost(sourceUrl)) {
    return NextResponse.json(
      { error: "Host de fonte bloqueado." },
      { status: 403 },
    );
  }

  let targetCandidates = await resolvePlayableSources(sourceUrl, false);
  if (!targetCandidates.length) {
    return NextResponse.json(
      { error: "Não foi possível resolver a fonte de vídeo." },
      { status: 502 },
    );
  }

  const hasAllowedCandidate = targetCandidates.some((url) => isAllowedHost(url));
  if (!hasAllowedCandidate) {
    return NextResponse.json({ error: "Host resolvido bloqueado." }, { status: 403 });
  }

  let attempt = await fetchFirstPlayableSource(targetCandidates, request);
  let upstream = attempt.upstream;
  let status = attempt.status || 0;
  let contentType = (attempt.contentType || "").toLowerCase();
  let attempts = attempt.attempts || [];
  const looksBlocked = !upstream || !upstream.ok || contentType.includes("text/html") || !upstream.body;

  if (looksBlocked && isBloggerVideoGatewayUrl(sourceUrl)) {
    const refreshed = await resolvePlayableSources(sourceUrl, true);
    const refreshHasAllowedCandidate = refreshed.some((url) => isAllowedHost(url));
    if (refreshHasAllowedCandidate) {
      targetCandidates = refreshed;
      attempt = await fetchFirstPlayableSource(targetCandidates, request);
      upstream = attempt.upstream;
      status = attempt.status || status;
      contentType = (attempt.contentType || contentType || "").toLowerCase();
      attempts = attempt.attempts || attempts;
    }
  }

  if (!upstream || !upstream.ok || !upstream.body || contentType.includes("text/html")) {
    return NextResponse.json(
      {
        error: "A fonte falhou ao carregar o vídeo.",
        status: status || 502,
        ...(debug
          ? {
              attempts: attempts.map((entry) => ({
                url: entry.url.slice(0, 240),
                status: entry.status,
                contentType: entry.contentType,
                blocked: entry.blocked,
              })),
            }
          : {}),
      },
      { status: status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: cloneMediaHeaders(upstream),
  });
}
