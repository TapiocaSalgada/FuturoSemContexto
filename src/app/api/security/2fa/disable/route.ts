import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

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

  const rateLimit = checkRateLimit(`2fa-disable:${result.user.id}:${getRequestIp(req)}`, 8, 15 * 60 * 1000);
  if (rateLimit.limited) return rateLimitResponse(rateLimit.retryAfter);

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "");
  const code = String(body?.code || "").trim();

  if (!result.user.password || !(await bcrypt.compare(password, result.user.password))) {
    return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  }

  const settings = await prisma.userSecuritySettings.findUnique({ where: { userId: result.user.id } });
  if (!settings?.twoFactorEnabled || !settings.twoFactorSecretEncrypted) {
    return NextResponse.json({ ok: true });
  }

  const secret = decryptSecret(settings.twoFactorSecretEncrypted);
  if (!verifyTotp(code, secret)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  await prisma.userSecuritySettings.update({
    where: { userId: result.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorPendingSecretEncrypted: null,
      twoFactorConfirmedAt: null,
    },
  });
  await recordSecurityEvent(result.user.id, "two_factor_disabled");

  return NextResponse.json({ ok: true });
}
