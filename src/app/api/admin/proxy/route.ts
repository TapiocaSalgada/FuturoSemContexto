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

  let url = `https://api-anime-free.vercel.app/api/${endpoint}`;
  if (id) url += `?id=${id}`;
  if (keyword) url += `?keyword=${encodeURIComponent(keyword)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API responded with error");
    const data = await res.json();
    
    // Transform Search RESULTS from Object to Array (Kappa API quirk)
    if (endpoint === "search" && data && typeof data === "object" && !Array.isArray(data)) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
            id,
            title: val.title,
            image: val.img || val.image,
            url: val.url
        }));
        return NextResponse.json(list);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
