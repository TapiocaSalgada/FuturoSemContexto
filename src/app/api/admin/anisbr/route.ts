import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { searchProviderWithFallback } from "@/lib/providers/search";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q =
    searchParams.get("name")?.trim() ||
    searchParams.get("q")?.trim() ||
    searchParams.get("keyword")?.trim() ||
    "";
  if (!q) {
    return NextResponse.json(
      {
        error: "Parametro obrigatorio: name (aceita q/keyword).",
        rule: "GET /api/admin/anisbr?name=<texto>",
      },
      { status: 400 },
    );
  }

  const results = await searchProviderWithFallback("anisbr", q, { allowKappaFallback: false });
  return NextResponse.json(results);
}
