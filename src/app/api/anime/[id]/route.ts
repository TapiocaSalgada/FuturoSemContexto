import { NextResponse } from "next/server";

import { getCatalogDetail } from "@/lib/catalog/compat";

export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const detail = await getCatalogDetail(params.id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...detail,
    description: detail.synopsis,
    coverImage: detail.posterUrl,
    bannerImage: detail.bannerUrl,
    heroBannerImage: detail.bannerUrl || detail.posterUrl || null,
  });
}
