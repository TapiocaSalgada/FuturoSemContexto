import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Recurso descontinuado: o produto agora e anime-only." },
    { status: 410 },
  );
}
