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
    
    // Normalize Kappa API: unwrap { sucesso: true, dados: [...] } or { success: true, video_url: "..." }
    const success = data?.sucesso || data?.success;
    if (data && success) {
        if (data.dados) data = data.dados;
        // else if it has video_url it's already at top level with success
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

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error", error);
    return NextResponse.json({ error: "Internal Server Error during Proxy" }, { status: 500 });
  }
}
