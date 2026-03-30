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
  const keyword = searchParams.get("keyword");
  if (!keyword) return NextResponse.json([]);

  try {
    const res = await fetch(`https://api-anime-free.vercel.app/api/search?keyword=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    
    // Transform object results into array if needed (Kappa API sometimes returns entries keyed by ID)
    if (data && typeof data === "object" && !Array.isArray(data)) {
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
    console.error("Proxy Search Error", error);
    return new NextResponse("Error fetching from API", { status: 500 });
  }
}
