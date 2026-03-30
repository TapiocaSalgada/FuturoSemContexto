import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Proxy para API_AnimesBrasil (theanimesapi.herokuapp.com)
// Uso: /api/admin/anisbr?name=one-piece

const BASE = "https://theanimesapi.herokuapp.com";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  const url = `${BASE}/anime/${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json({ error: `AnimesBrasil respondeu ${res.status}` }, { status: res.status });
    }
    const data = await res.json();

    // Normaliza para lista com id/title/image/url
    const items = Array.isArray(data) ? data : data?.episodes || [];
    const normalized = items.map((item: any) => ({
      id: item?.id || item?.episode_id || item?.ep_name || item?.name || "",
      title: item?.name || item?.ep_name || item?.title || "Sem título",
      image: item?.img || item?.image || item?.thumb || "",
      url: item?.url || item?.link || item?.episode || "",
      raw: item,
    })).filter(i => i.id && i.title);

    return NextResponse.json(normalized);
  } catch (err) {
    return NextResponse.json({ error: "Erro interno no proxy AnimesBrasil" }, { status: 500 });
  }
}
