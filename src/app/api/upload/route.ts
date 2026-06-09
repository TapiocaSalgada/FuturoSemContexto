import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBanActive } from "@/lib/ban";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";

const MAX_UPLOAD_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`upload:${session.user.email}:${getRequestIp(req)}`, 30, 15 * 60 * 1000);
    if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, banned: true, banReason: true, bannedAt: true, bannedUntil: true },
    });
    if (isBanActive(user)) return NextResponse.json({ error: "Conta suspensa." }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const extension = ALLOWED_IMAGE_TYPES[file.type];
    if (!extension) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `users/${user?.id || "unknown"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.storage
      .from("uploads")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: "Não foi possível enviar o arquivo." }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("uploads")
      .getPublicUrl(data.path);

    return NextResponse.json({ url: publicData.publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Falha no upload." }, { status: 500 });
  }
}
/**
 * Media upload endpoint.
 */
