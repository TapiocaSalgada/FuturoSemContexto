import { NextResponse } from "next/server";

import { getCatalogHomePayload } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getCatalogHomePayload();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "s-maxage=45, stale-while-revalidate=120",
    },
  });
}
