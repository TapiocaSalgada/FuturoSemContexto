import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";

const DEFAULT_KAPPA_BASE = "https://anime-api-kappa-one.vercel.app/api";

type EndpointName = "search" | "episodes" | "episode-video";

type EpisodeItem = {
  id: string;
  number: number;
  title: string;
  link: string | null;
  thumbnail: string | null;
};

function parseJsonSafely(text: string) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchPayload(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });

  const text = await response.text();
  const payload = parseJsonSafely(text);

  return {
    ok: response.ok,
    status: response.status,
    payload,
    raw: text,
  };
}

function unwrapEnvelope(payload: any) {
  if (!payload || typeof payload !== "object") return payload;

  const success = payload?.sucesso ?? payload?.success;
  if (success === true) {
    return payload?.dados ?? payload?.data ?? payload?.results ?? payload;
  }

  return payload?.dados ?? payload?.data ?? payload?.results ?? payload;
}

function extractList(payload: any) {
  const value = unwrapEnvelope(payload);
  if (!value) return [] as any[];
  if (Array.isArray(value)) return value;

  if (typeof value === "object") {
    const nestedArray = [value?.items, value?.animes, value?.episodes].find((entry) => Array.isArray(entry));
    if (Array.isArray(nestedArray)) return nestedArray;

    const objectEntries = Object.entries(value)
      .filter(([key, item]) => {
        if (!item || typeof item !== "object") return false;
        return !["success", "sucesso", "status", "message", "error", "info"].includes(key);
      })
      .map(([id, item]) => ({ id, ...(item as Record<string, unknown>) }));

    if (objectEntries.length > 0) return objectEntries;
  }

  return [] as any[];
}

function normalizeSearchItems(payload: any) {
  const list = extractList(payload);

  return list
    .map((item: any, index: number) => ({
      id: String(item?.id || item?.anime_id || item?.animeId || item?.slug || `item-${index}`),
      title: String(item?.title || item?.nome || item?.name || "").trim() || "Titulo indisponivel",
      image:
        String(item?.img || item?.image || item?.image_url || "").trim() ||
        "https://img.freepik.com/premium-vector/photo-icon-with-picture-landscape-vector-isolated-white-background-eps-10_399089-2810.jpg",
      url: String(item?.url || item?.link || "#").trim() || "#",
    }))
    .filter((item) => Boolean(item.title));
}

function normalizeEpisodes(payload: any): EpisodeItem[] {
  const list = extractList(payload);

  return list.map((item: any, idx: number) => {
    const rawNumber = item?.episodio ?? item?.number ?? item?.episode ?? idx + 1;
    const number = Number(rawNumber);

    return {
      id: String(item?.id || item?.episode_id || item?.episodio_id || `ep-${idx}`),
      number: Number.isFinite(number) && number > 0 ? number : idx + 1,
      title: String(item?.episode_name || item?.title || `Episodio ${rawNumber}`),
      link: item?.link || item?.url || null,
      thumbnail: item?.imagem || item?.image || null,
    };
  });
}

function extractVideoUrl(payload: any, depth = 0): string {
  if (!payload || depth > 3) return "";

  if (typeof payload === "string") {
    return payload.startsWith("http") ? payload : "";
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const found = extractVideoUrl(entry, depth + 1);
      if (found) return found;
    }
    return "";
  }

  const value = unwrapEnvelope(payload);
  const directCandidates = [
    value?.videoUrl,
    value?.video_url,
    value?.url,
    value?.link,
    value?.file,
    value?.stream,
    value?.src,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim().startsWith("http")) {
      return candidate.trim();
    }
  }

  const nestedCandidates = [
    value?.data,
    value?.dados,
    value?.result,
    value?.results,
    value?.item,
    value?.episode,
    value?.source,
    value?.sources,
    value?.streams,
    value?.links,
  ];

  for (const candidate of nestedCandidates) {
    const found = extractVideoUrl(candidate, depth + 1);
    if (found) return found;
  }

  return "";
}

function getEndpointPaths(endpoint: EndpointName, params: URLSearchParams) {
  const query =
    params.get("keyword")?.trim() ||
    params.get("q")?.trim() ||
    params.get("query")?.trim() ||
    "";

  const id =
    params.get("id")?.trim() ||
    params.get("anime_id")?.trim() ||
    params.get("episode_id")?.trim() ||
    "";

  if (endpoint === "search") {
    if (!query) return [] as string[];
    const q = encodeURIComponent(query);
    return [`/search?keyword=${q}`, `/search?q=${q}`];
  }

  if (endpoint === "episodes") {
    if (!id) return [] as string[];
    const encoded = encodeURIComponent(id);
    return [`/episodes?anime_id=${encoded}`, `/episodes?id=${encoded}`];
  }

  if (!id) return [] as string[];
  const encoded = encodeURIComponent(id);
  return [`/episode-video?episode_id=${encoded}`, `/episode-video?id=${encoded}`];
}

function normalizeEndpointResponse(endpoint: EndpointName, payload: any) {
  if (endpoint === "search") {
    return normalizeSearchItems(payload);
  }

  if (endpoint === "episodes") {
    return normalizeEpisodes(payload);
  }

  const videoUrl = extractVideoUrl(payload);
  return videoUrl ? { videoUrl } : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const endpointRaw = String(searchParams.get("endpoint") || "").trim().toLowerCase();

  if (!["search", "episodes", "episode-video"].includes(endpointRaw)) {
    return NextResponse.json(
      {
        error: "Endpoint invalido. Use search, episodes ou episode-video.",
      },
      { status: 400 },
    );
  }

  const endpoint = endpointRaw as EndpointName;
  const baseUrl = (process.env.KAPPA_API_BASE?.trim() || DEFAULT_KAPPA_BASE).replace(/\/+$/, "");
  const paths = getEndpointPaths(endpoint, searchParams);

  if (paths.length === 0) {
    return NextResponse.json(
      {
        error: endpoint === "search" ? "Parametro q/keyword obrigatorio." : "Parametro id obrigatorio.",
      },
      { status: 400 },
    );
  }

  const errors: string[] = [];

  for (const path of paths) {
    const upstreamUrl = `${baseUrl}${path}`;

    try {
      const result = await fetchPayload(upstreamUrl);
      if (!result.ok) {
        errors.push(`status ${result.status} em ${path}`);
        continue;
      }

      const normalized = normalizeEndpointResponse(endpoint, result.payload);

      if (endpoint === "episode-video") {
        if (normalized && typeof normalized === "object" && "videoUrl" in normalized) {
          return NextResponse.json(normalized);
        }
      } else if (Array.isArray(normalized) && normalized.length > 0) {
        return NextResponse.json(normalized);
      } else if (Array.isArray(normalized) && normalized.length === 0) {
        return NextResponse.json(normalized);
      }

      errors.push(`formato invalido em ${path}`);
    } catch (error) {
      errors.push(`falha em ${path}: ${error instanceof Error ? error.message : "erro"}`);
    }
  }

  const notFound = errors.some((entry) => entry.includes("status 404"));
  return NextResponse.json(
    {
      error: `Falha ao normalizar resposta de ${endpoint}.`,
      details: errors,
    },
    { status: notFound ? 404 : 502 },
  );
}