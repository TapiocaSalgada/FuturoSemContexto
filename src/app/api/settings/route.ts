import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  theme: "pink",
  reducedMotion: false,
  neonEffects: true,
  showHistory: true,
  autoplay: true,
  resumePlayback: true,
  publicProfile: true,
  allowFollow: true,
  playbackSpeed: "Normal",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json(DEFAULT_SETTINGS);

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json(DEFAULT_SETTINGS);

  // Settings stored as JSON in user bio field as temporary storage
  // We'll use a separate approach: store in a simple key-value in the db
  // For now return defaults merged with any stored settings
  return NextResponse.json(DEFAULT_SETTINGS);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Settings are stored in localStorage on the client for now
  // This endpoint is a no-op that confirms receipt
  return NextResponse.json({ ok: true, settings: body });
}
