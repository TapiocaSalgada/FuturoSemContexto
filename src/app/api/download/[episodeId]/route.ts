import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { detectVideoSource, normalizePlaybackUrl } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeFilePart(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();

  return cleaned || "episodio";
}

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "";
  const value = contentType.toLowerCase();
  if (value.includes("mp4")) return "mp4";
  if (value.includes("webm")) return "webm";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("matroska") || value.includes("mkv")) return "mkv";
  if (value.includes("mpegurl") || value.includes("m3u8")) return "m3u8";
  return "";
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

function resolveSourceUrl(videoUrl: string, requestUrl: string) {
  if (videoUrl.startsWith("//")) return `https:${videoUrl}`;
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl;

  const origin = new URL(requestUrl).origin;
  const path = videoUrl.startsWith("/") ? videoUrl : `/${videoUrl}`;
  return `${origin}${path}`;
}

function providerDownloadUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("drive.google.com")) {
      const fileIdMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
      const fileId = fileIdMatch?.[1] || parsed.searchParams.get("id");
      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
      }
    }

    if (host.includes("dropbox.com")) {
      parsed.searchParams.set("dl", "1");
      return parsed.toString();
    }
  } catch {
    return rawUrl;
  }

  return rawUrl;
}

export async function GET(
  req: Request,
  { params }: { params: { episodeId: string } },
) {
  const episodeId = String(params?.episodeId || "").trim();
  if (!episodeId) {
    return new NextResponse("episodeId obrigatorio.", { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      number: true,
      season: true,
      videoUrl: true,
      sourceType: true,
      anime: {
        select: {
          title: true,
          visibility: true,
        },
      },
    },
  });

  if (!episode) return new NextResponse("Episodio nao encontrado.", { status: 404 });
  if (!isAdmin && String(episode.anime.visibility || "").toLowerCase() !== "public") {
    return new NextResponse("Nao encontrado.", { status: 404 });
  }
  if (!episode.videoUrl) {
    return new NextResponse("Episodio sem link de video.", { status: 404 });
  }

  const normalizedVideoUrl = normalizePlaybackUrl(episode.videoUrl);
  const sourceKind = detectVideoSource(normalizedVideoUrl, episode.sourceType || undefined);
  if (sourceKind === "embed" || sourceKind === "external" || sourceKind === "youtube") {
    return new NextResponse(
      "Essa fonte nao permite download direto. Tente uma fonte MP4/HLS.",
      { status: 409 },
    );
  }

  const resolvedUrl = providerDownloadUrl(resolveSourceUrl(normalizedVideoUrl, req.url));

  try {
    const requestOrigin = new URL(req.url).origin;
    const parsedResolved = new URL(resolvedUrl, requestOrigin);
    const isRemoteHttp =
      /^https?:$/i.test(parsedResolved.protocol) && parsedResolved.origin !== requestOrigin;

    if (isRemoteHttp) {
      return NextResponse.redirect(parsedResolved.toString(), { status: 307 });
    }
  } catch {
    // fallback to proxy stream mode below
  }

  let upstream: Response;
  try {
    upstream = await fetch(resolvedUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        accept: "*/*",
        "user-agent": "Mozilla/5.0 FuturoStreamDownloader/1.0",
        referer: `${new URL(req.url).origin}/`,
      },
    });
  } catch {
    return new NextResponse("Falha ao conectar na fonte do video.", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("A fonte recusou download direto.", { status: 409 });
  }

  const upstreamType = upstream.headers.get("content-type") || "application/octet-stream";
  if (upstreamType.toLowerCase().includes("text/html")) {
    return new NextResponse(
      "Esta fonte bloqueou download direto. Troque para uma fonte MP4.",
      { status: 409 },
    );
  }

  const ext = extensionFromContentType(upstreamType) || extensionFromUrl(resolvedUrl) || "mp4";
  const animeName = normalizeFilePart(episode.anime.title || "anime");
  const filename = `${animeName}-t${episode.season}e${episode.number}.${ext}`;

  const headers = new Headers();
  headers.set("Content-Type", upstreamType);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Cache-Control", "no-store");

  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
