import { NextResponse } from "next/server";

import { encryptSecret } from "@/lib/secret-crypto";
import { requireSecurityUser } from "@/lib/security-auth";
import { buildOtpAuthUri, generateTotpSecret } from "@/lib/totp";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { isAccountTwoFactorEnabled } from "@/lib/server-features";

export async function POST(req: Request) {
  if (!isAccountTwoFactorEnabled()) {
    return NextResponse.json({ error: "2FA indisponível nesta versão." }, { status: 404 });
  }

  const result = await requireSecurityUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const rateLimit = checkRateLimit(`2fa-setup:${result.user.id}:${getRequestIp(req)}`, 8, 15 * 60 * 1000);
  if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

  const current = await prisma.userSecuritySettings.upsert({
    where: { userId: result.user.id },
    update: {},
    create: { userId: result.user.id },
  });
  if (current.twoFactorEnabled) {
    return NextResponse.json({ error: "A autenticação em dois fatores já está ativa." }, { status: 409 });
  }

  const secret = generateTotpSecret();
  await prisma.userSecuritySettings.update({
    where: { userId: result.user.id },
    data: { twoFactorPendingSecretEncrypted: encryptSecret(secret) },
  });

  return NextResponse.json({
    secret,
    otpauthUri: buildOtpAuthUri({
      issuer: "Futuro sem Contexto",
      account: result.user.email,
      secret,
    }),
  });
}
