import { createHash } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import prisma from "@/lib/prisma";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { isPasswordResetEnabled } from "@/lib/server-features";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(`reset-password:${getRequestIp(req)}`, 8, 15 * 60 * 1000);
    if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

    if (!isPasswordResetEnabled()) {
      return NextResponse.json({ error: "Recuperação de senha indisponível." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || password.length < 6) {
      return NextResponse.json({ error: "Link inválido ou senha muito curta." }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ message: "Senha alterada." });
  } catch (error) {
    console.error("[password-reset] Erro no reset-password", error);
    return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 500 });
  }
}
