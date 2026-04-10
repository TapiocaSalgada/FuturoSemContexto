import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  type ProviderKey,
  searchProviderWithFallback,
} from "@/lib/providers/search";

const ALLOWED_PROVIDERS: ProviderKey[] = [
  "kappa",
  "sugoi",
  "anisbr",
  "anfire",
  "animefenix",
  "playanimes",
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error role
  if (!session || session.user?.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyword =
    searchParams.get("keyword")?.trim() ||
    searchParams.get("q")?.trim() ||
    searchParams.get("query")?.trim() ||
    "";

  if (!keyword) {
    return NextResponse.json([]);
  }

  const providerRaw = String(searchParams.get("provider") || "kappa").trim().toLowerCase();
  const provider = (ALLOWED_PROVIDERS.includes(providerRaw as ProviderKey)
    ? providerRaw
    : "kappa") as ProviderKey;

  const allowKappaFallback = provider !== "kappa";
  const items = await searchProviderWithFallback(provider, keyword, { allowKappaFallback });

  return NextResponse.json(items);
}