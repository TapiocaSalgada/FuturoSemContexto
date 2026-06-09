import { NextResponse } from "next/server";

import { decryptSecret } from "@/lib/secret-crypto";
import { requireSecurityUser } from "@/lib/security-auth";
import { verifyTotp } from "@/lib/totp";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";
import { isAccountTwoFactorEnabled } from "@/lib/server-features";

export async function POST(req: Request) {
  if (!isAccountTwoFactorEnabled()) {
    return NextResponse.json({ error: "2FA indisponível nesta versão." }, { status: 404 });
  }

  const result = await requireSecurityUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const rateLimit = checkRateLimit(`2fa-confirm:${result.user.id}:${getRequestIp(req)}`, 10, 15 * 60 * 1000);
  if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "").trim();
  const settings = await prisma.userSecuritySettings.findUnique({ where: { userId: result.user.id } });
  if (!settings?.twoFactorPendingSecretEncrypted) {
    return NextResponse.json({ error: "Inicie a configuração do 2FA novamente." }, { status: 400 });
  }

  const secret = decryptSecret(settings.twoFactorPendingSecretEncrypted);
  if (!verifyTotp(code, secret)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  await prisma.userSecuritySettings.update({
    where: { userId: result.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: settings.twoFactorPendingSecretEncrypted,
      twoFactorPendingSecretEncrypted: null,
      twoFactorConfirmedAt: new Date(),
    },
  });
  await recordSecurityEvent(result.user.id, "two_factor_enabled");

  return NextResponse.json({ ok: true });
}
