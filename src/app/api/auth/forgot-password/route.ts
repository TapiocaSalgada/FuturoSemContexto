import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { isPasswordResetEnabled } from "@/lib/server-features";

const GENERIC_MESSAGE = "Se esse e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.";
const RESET_TOKEN_TTL_MINUTES = 45;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(req: Request) {
  const envUrl = process.env.NEXTAUTH_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function sendResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[password-reset] Link de desenvolvimento para ${email}: ${resetUrl}`);
    } else {
      console.warn("[password-reset] RESEND_API_KEY/EMAIL_FROM ausentes. E-mail de recuperação não enviado.");
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Redefinir senha - Futuro sem Contexto",
      text: `Use este link para redefinir sua senha: ${resetUrl}\n\nO link expira em ${RESET_TOKEN_TTL_MINUTES} minutos.`,
      html: `<p>Use este link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>O link expira em ${RESET_TOKEN_TTL_MINUTES} minutos.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[password-reset] Falha ao enviar e-mail", response.status, body);
  }
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(`forgot-password:${getRequestIp(req)}`, 6, 15 * 60 * 1000);
    if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

    if (!isPasswordResetEnabled()) {
      console.warn("[password-reset] Fluxo desativado: configure ENABLE_PASSWORD_RESET, RESEND_API_KEY e EMAIL_FROM.");
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user?.id) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${getBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendResetEmail(user.email, resetUrl);
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[password-reset] Erro no forgot-password", error);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
