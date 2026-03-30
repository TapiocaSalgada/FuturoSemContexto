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

    const data = await res.json();
    
    // Transform Search RESULTS from Object to Array (Kappa API quirk)
    // Adding defensive fallbacks for title/image to avoid UI labels like 'API ID: ERROR'
    if (endpoint === "search" && data && typeof data === "object" && !Array.isArray(data)) {
        const list = Object.entries(data)
          .filter(([id, val]: [string, any]) => val && id !== "null")
          .map(([id, val]: [string, any]) => ({
            id: id || "unknown",
            title: val.title || "Título indisponível",
            image: val.img || val.image || "https://img.freepik.com/premium-vector/photo-icon-with-picture-landscape-vector-isolated-white-background-eps-10_399089-2810.jpg",
            url: val.url || "#"
          }));
        return NextResponse.json(list);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error", error);
    return NextResponse.json({ error: "Internal Server Error during Proxy" }, { status: 500 });
  }
}
