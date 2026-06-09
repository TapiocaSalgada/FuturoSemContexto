import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  ".supabase.co",
  "ui-avatars.com",
  "images.unsplash.com",
  "cdn.anilist.co",
  "s4.anilist.co",
  ".googleusercontent.com",
  "cdn.discordapp.com",
  "avatars.githubusercontent.com",
  "api.dicebear.com",
  "cdn.myanimelist.net",
  "myanimelist.net",
  "goyabu.io",
  "static.wikia.nocookie.net",
  ".ytimg.com",
  "gqcanimes.com.br",
  "media.fstatic.com",
  "api.myblogapi.site",
  "m.media-amazon.com",
  "uploads.mangadex.org",
  "image.tmdb.org",
  ".thetvdb.com",
];

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((entry) => {
    const rule = entry.toLowerCase();
    if (rule.startsWith(".")) return host.endsWith(rule);
    return host === rule || host.endsWith(`.${rule}`);
  });
}

export async function GET(req: NextRequest) {
  const url = String(req.nextUrl.searchParams.get("url") || "").trim();
  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(target.toString(), {
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: controller.signal,
      headers: {
        accept: "image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 FuturoStreamImageProxy/1.0",
      },
    });
    clearTimeout(timeout);

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Upstream error", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse("Unsupported content", { status: 415 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Proxy failure", { status: 502 });
  }
}
