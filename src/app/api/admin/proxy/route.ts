import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint"); // search, episodes, episode-video
  const id = searchParams.get("id");
  const keyword = searchParams.get("keyword");

  if (!endpoint) return new NextResponse("Endpoint required", { status: 400 });

  const baseUrl = "https://anime-api-kappa-one.vercel.app/api";
  let url = `${baseUrl}/${endpoint}`;
  
  const params = new URLSearchParams();
  if (endpoint === "search" && keyword) params.append("keyword", keyword);
  if (endpoint === "episodes" && id) params.append("anime_id", id);
  if (endpoint === "episode-video" && id) params.append("episode_id", id);

  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
        return NextResponse.json({ error: `API responded with status ${res.status} [${endpoint}]` }, { status: res.status });
    }
    
    // Safety check for JSON content type
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        return NextResponse.json({ error: "Invalid response format from API" }, { status: 502 });
    }

    let data = await res.json();

    // Normalize envelopes and field names used by the Kappa API
    const success = data?.sucesso || data?.success;
    if (data && success) {
        if (Array.isArray(data.dados)) data = data.dados;
        else if (Array.isArray(data.data)) data = data.data;
        else if (data.video_url || data.videoUrl) data = { videoUrl: data.video_url || data.videoUrl };
    }

    // Transform Search results if they come as a named object-map (OLD API legacy fallback)
    if (endpoint === "search") {
        if (data && typeof data === "object" && !Array.isArray(data)) {
            data = Object.entries(data)
                .filter(([id, val]: [string, any]) => val && id !== "null")
                .map(([id, val]: [string, any]) => ({
                    id: id || "unknown",
                    title: val.title || "Título indisponível",
                    image: val.img || val.image || "https://img.freepik.com/premium-vector/photo-icon-with-picture-landscape-vector-isolated-white-background-eps-10_399089-2810.jpg",
                    url: val.url || "#"
                }));
        } else if (Array.isArray(data)) {
            // New API Array format - ensure id mapping is consistent
            data = data.map((item: any) => ({
                id: item.id || item.anime_id || "unknown",
                title: item.title || item.nome || "Indisponível",
                image: item.img || item.image || item.image_url || "https://img.freepik.com/premium-vector/photo-icon-with-picture-landscape-vector-isolated-white-background-eps-10_399089-2810.jpg",
                url: item.url || "#"
            }));
        }
    }

    // Normalize episodes payload (API returns { success, data: [...] })
    if (endpoint === "episodes") {
        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid episodes payload from API" }, { status: 502 });
        }

        data = data.map((item: any, idx: number) => {
            const number = Number(item.episodio || item.number || item.episode || idx + 1);
            return {
                id: item.id || item.episode_id || item.episodio_id || `ep-${idx}`,
                number: Number.isFinite(number) ? number : idx + 1,
                title: item.episode_name || item.title || `Episódio ${item.episodio || idx + 1}`,
                link: item.link || item.url || null,
                thumbnail: item.imagem || item.image || null,
            };
        });
    }

    // Normalize episode video payload (expects { videoUrl })
    if (endpoint === "episode-video") {
        const videoUrl = data?.videoUrl || data?.video_url;
        if (!videoUrl) {
            return NextResponse.json({ error: "Video URL not found in API response" }, { status: 502 });
        }
        data = { videoUrl };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error", error);
    return NextResponse.json({ error: "Internal Server Error during Proxy" }, { status: 500 });
  }
}
