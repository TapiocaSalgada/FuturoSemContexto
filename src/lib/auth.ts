import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "futur0s3mc0nt3xt0";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  avatarUrl: true,
  role: true,
} as const;

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
        email: { label: "Email", type: "email", placeholder: "seu@email.com" },
        password: { label: "Senha", type: "password" },
        isQuick: { label: "isQuick", type: "text" }
      },
      async authorize(credentials) {
        const identifier = String(credentials?.email || "").trim();
        const providedPassword = String(credentials?.password || "");

        if (!identifier || !providedPassword) {
          throw new Error("Invalid credentials");
        }

        // Support login by username (no @ in input) or email
        let user: {
          id: string;
          name: string;
          email: string;
          password: string | null;
          avatarUrl: string | null;
          role: string;
        } | null = null;
        try {
          if (identifier.includes("@")) {
            user = await withDbRetry(() =>
              prisma.user.findFirst({
                where: {
                  email: { equals: identifier, mode: "insensitive" },
                },
                select: authUserSelect,
              }),
            );
          } else {
            const candidates = await withDbRetry(() =>
              prisma.user.findMany({
                where: {
                  name: { contains: identifier, mode: "insensitive" },
                },
                take: 12,
                select: authUserSelect,
              }),
            );

            const normalizedIdentifier = identifier.toLowerCase();
            user =
              candidates.find(
                (candidate) => String(candidate.name || "").trim().toLowerCase() === normalizedIdentifier,
              ) ||
              candidates.find(
                (candidate) => String(candidate.name || "").toLowerCase().startsWith(normalizedIdentifier),
              ) ||
              null;
          }
        } catch (error) {
          if (isPoolExhaustedError(error)) {
            throw new Error("Servidor ocupado no momento. Tente novamente em alguns segundos.");
          }
          throw error;
        }

        if (!user) {
          throw new Error("Usuário não encontrado.");
        }

        if (!user.password) {
          throw new Error("Sua conta não possui senha. Contate o administrador.");
        }

        const isQuick = credentials?.isQuick === "true";
        if (isQuick) {
          const expectedHash = crypto.createHash("sha256")
            .update(user.id + user.password + SECRET)
            .digest("hex");
            
          if (credentials?.password !== expectedHash) {
            throw new Error("Sessão expirada. Entre com a senha novamente.");
          }
        } else {
          const isPasswordValid = await bcrypt.compare(providedPassword, user.password);
          if (!isPasswordValid) {
            throw new Error("Senha incorreta.");
          }
        }

        const handoffHash = crypto.createHash("sha256")
            .update(user.id + user.password + SECRET)
            .digest("hex");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
          handoffHash: handoffHash
        };
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.image) {
        token.picture = session.image;
      }

      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.picture = (user as any).avatarUrl || user.image || token.picture;
        token.handoffHash = (user as any).handoffHash;
      }
      // Sync role + avatar + handoff hash from DB only when needed/throttled
      const now = Math.floor(Date.now() / 1000);
      const nextSyncAt = Number((token as any).nextDbSyncAt || 0);
      const shouldSyncFromDb =
        Boolean(token.id) &&
        (
          Boolean(user) ||
          trigger === "update" ||
          !token.role ||
          !token.picture ||
          !(token as any).handoffHash ||
          now >= nextSyncAt
        );

      if (token.id && shouldSyncFromDb) {
        try {
          const dbUser = await withDbRetry(() =>
            prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, avatarUrl: true, password: true },
            }),
          );
          if (dbUser) {
            token.role = dbUser.role;
            if (dbUser.avatarUrl) token.picture = dbUser.avatarUrl;
            // Update handoff hash if password changed
            if (dbUser.password) {
               token.handoffHash = crypto.createHash("sha256")
                 .update((token.id as string) + dbUser.password + SECRET)
                 .digest("hex");
             }
          }
          (token as any).nextDbSyncAt = now + 600;
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role;
        (session.user as any).handoffHash = token.handoffHash;
        // Make avatar available immediately without extra fetch
        session.user.image = (token.picture as string) || session.user.image;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "futur0s3mc0nt3xt0",
};
