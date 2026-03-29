import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "seu@email.com" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Support login by username (no @ in input) or email
        let user;
        if (credentials.email.includes("@")) {
          user = await prisma.user.findUnique({ where: { email: credentials.email } });
        } else {
          user = await prisma.user.findFirst({ where: { name: { equals: credentials.email, mode: "insensitive" } } });
        }

        if (!user) {
          throw new Error("Usuário não encontrado.");
        }

        if (!user.password) {
          throw new Error("Sua conta não possui senha. Contate o administrador.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Senha incorreta.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
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
      }
      // Sync role + avatar from DB (lightweight select)
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, avatarUrl: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            if (dbUser.avatarUrl) token.picture = dbUser.avatarUrl;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role;
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
