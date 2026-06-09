import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { isBanActive } from "./ban";
import { decryptSecret } from "./secret-crypto";
import { recordSecurityEvent } from "./security-events";
import { verifyTotp } from "./totp";
import { isAccountTwoFactorEnabled } from "./server-features";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required");
}

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  avatarUrl: true,
  role: true,
  banned: true,
  banReason: true,
  bannedAt: true,
  bannedUntil: true,
} as const;

function normalizeLookup(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function rankIdentifierMatches<
  T extends { name: string; email: string },
>(users: T[], identifier: string): T | null {
  const normalizedIdentifier = normalizeLookup(identifier);
  if (!normalizedIdentifier) return null;

  let best: { user: T; score: number } | null = null;

  for (const candidate of users) {
    const normalizedName = normalizeLookup(candidate.name || "");
    const normalizedEmail = normalizeLookup(candidate.email || "");
    const normalizedEmailLocal = normalizedEmail.split("@")[0] || "";

    let score = 0;
    if (normalizedEmail === normalizedIdentifier) score = Math.max(score, 100);
    if (normalizedName === normalizedIdentifier) score = Math.max(score, 96);
    if (normalizedEmailLocal === normalizedIdentifier) score = Math.max(score, 94);
    if (normalizedName.startsWith(normalizedIdentifier)) score = Math.max(score, 78);
    if (normalizedEmailLocal.startsWith(normalizedIdentifier)) score = Math.max(score, 74);
    if (normalizedEmail.startsWith(normalizedIdentifier)) score = Math.max(score, 70);
    if (normalizedName.includes(normalizedIdentifier)) score = Math.max(score, 58);
    if (normalizedEmail.includes(normalizedIdentifier)) score = Math.max(score, 50);

    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { user: candidate, score };
      continue;
    }
  }

  return best?.user || null;
}

function isPoolExhaustedError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("maxclientsinsessionmode") ||
    message.includes("max clients reached") ||
    message.includes("too many connections")
  );
}

async function withDbRetry<T>(fn: () => Promise<T>, attempts = 2, waitMs = 200): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isPoolExhaustedError(error) || attempt >= attempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs * attempt));
    }
  }

  throw lastError;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "E-mail ou usuÃ¡rio", type: "text", placeholder: "seu@email.com ou usuÃ¡rio" },
        email: { label: "E-mail ou usuÃ¡rio", type: "text", placeholder: "seu@email.com ou usuÃ¡rio" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(
          (credentials as Record<string, unknown> | null)?.identifier ||
            credentials?.email ||
            "",
        ).trim();
        const providedPassword = String(credentials?.password || "");

        if (!identifier || !providedPassword) {
          throw new Error("Invalid credentials");
        }

        let user: {
          id: string;
          name: string;
          email: string;
          password: string | null;
          avatarUrl: string | null;
          role: string;
          banned: boolean;
          banReason: string | null;
          bannedAt: Date | null;
          bannedUntil: Date | null;
        } | null = null;

        try {
          user = await withDbRetry(() =>
            prisma.user.findFirst({
              where: {
                email: { equals: identifier, mode: "insensitive" },
              },
              select: authUserSelect,
            }),
          );

          if (!user) {
            const exactNameMatches = await withDbRetry(() =>
              prisma.user.findMany({
                where: {
                  name: { equals: identifier, mode: "insensitive" },
                },
                take: 5,
                select: authUserSelect,
              }),
            );
            if (exactNameMatches.length === 1) {
              user = exactNameMatches[0];
            } else if (exactNameMatches.length > 1) {
              throw new Error("Existe mais de um usuÃ¡rio com esse nome. Use seu e-mail.");
            }
          }

          if (!user && !identifier.includes("@")) {
            const byEmailLocalPart = await withDbRetry(() =>
              prisma.user.findMany({
                where: {
                  email: { startsWith: `${identifier}@`, mode: "insensitive" },
                },
                take: 5,
                select: authUserSelect,
              }),
            );
            if (byEmailLocalPart.length === 1) {
              user = byEmailLocalPart[0];
            } else if (byEmailLocalPart.length > 1) {
              throw new Error("Encontramos varias contas parecidas. Use o e-mail completo.");
            }
          }

          if (!user) {
            const candidates = await withDbRetry(() =>
              prisma.user.findMany({
                where: {
                  OR: [
                    { name: { contains: identifier, mode: "insensitive" } },
                    { email: { contains: identifier, mode: "insensitive" } },
                  ],
                },
                take: 20,
                select: authUserSelect,
              }),
            );
            user = rankIdentifierMatches(candidates, identifier);
          }
        } catch (error) {
          if (isPoolExhaustedError(error)) {
            throw new Error("Servidor ocupado no momento. Tente novamente em alguns segundos.");
          }
          throw error;
        }

        if (!user) {
          throw new Error("UsuÃ¡rio nÃ£o encontrado.");
        }

        if (!user.password) {
          throw new Error("Sua conta nÃ£o possui senha. Contate o administrador.");
        }

        if (isBanActive(user)) {
          throw new Error("Conta suspensa. Acesse a tela de suspensÃ£o para mais detalhes.");
        }

        const isPasswordValid = await bcrypt.compare(providedPassword, user.password);
        if (!isPasswordValid) {
          throw new Error("Senha incorreta.");
        }
        if (isAccountTwoFactorEnabled()) {
          const securitySettings = await prisma.userSecuritySettings.findUnique({
            where: { userId: user.id },
            select: { twoFactorEnabled: true, twoFactorSecretEncrypted: true },
          });

          if (securitySettings?.twoFactorEnabled) {
            const code = String((credentials as Record<string, unknown> | null)?.totpCode || "").trim();
            const encryptedSecret = securitySettings.twoFactorSecretEncrypted;
            if (!encryptedSecret || !verifyTotp(code, decryptSecret(encryptedSecret))) {
              throw new Error("CÃ³digo de autenticaÃ§Ã£o invÃ¡lido.");
            }
          }
        }

        await recordSecurityEvent(user.id, "login_success").catch(() => {});

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          bannedAt: user.bannedAt,
          bannedUntil: user.bannedUntil,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update") {
        if (session?.image) token.picture = session.image;
        if (session?.name) token.name = session.name;
      }

      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        (token as any).banned = Boolean((user as any).banned);
        (token as any).banReason = (user as any).banReason || null;
        (token as any).bannedAt = (user as any).bannedAt ?new Date((user as any).bannedAt).toISOString() : null;
        (token as any).bannedUntil = (user as any).bannedUntil ?new Date((user as any).bannedUntil).toISOString() : null;
        token.name = user.name || token.name;
        token.picture = (user as any).avatarUrl || user.image || token.picture;
      }

      const now = Math.floor(Date.now() / 1000);
      const nextSyncAt = Number((token as any).nextDbSyncAt || 0);
      const shouldSyncFromDb =
        Boolean(token.id) &&
        (Boolean(user) || trigger === "update" || !token.role || !token.picture || now >= nextSyncAt);

      if (token.id && shouldSyncFromDb) {
        try {
          const dbUser = await withDbRetry(() =>
            prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, avatarUrl: true, banned: true, banReason: true, bannedAt: true, bannedUntil: true },
            }),
          );

          if (dbUser) {
            token.role = dbUser.role;
            if (dbUser.avatarUrl) token.picture = dbUser.avatarUrl;
            (token as any).banned = isBanActive(dbUser);
            (token as any).banReason = dbUser.banReason || null;
            (token as any).bannedAt = dbUser.bannedAt ?dbUser.bannedAt.toISOString() : null;
            (token as any).bannedUntil = dbUser.bannedUntil ?dbUser.bannedUntil.toISOString() : null;
          }
          (token as any).nextDbSyncAt = now + 600;
        } catch {
          // ignore db sync failures
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role;
        (session.user as any).banned = Boolean((token as any).banned);
        (session.user as any).banReason = (token as any).banReason || null;
        (session.user as any).bannedAt = (token as any).bannedAt || null;
        (session.user as any).bannedUntil = (token as any).bannedUntil || null;
        if (token.name) session.user.name = String(token.name);
        session.user.image = (token.picture as string) || session.user.image;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
