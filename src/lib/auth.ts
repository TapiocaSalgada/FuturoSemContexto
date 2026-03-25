import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    }),
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
          throw new Error("Esta conta foi criada com o Discord. Faça login pelo Discord.");
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
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord") {
        if (!user.email) return false;
        let dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || "Discord User",
              avatarUrl: user.image,
            }
          });
        }
        user.id = dbUser.id;
        (user as any).role = dbUser.role;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      // Always sync the latest role from DB to avoid requiring logout
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true } });
          if (dbUser) token.role = dbUser.role;
        } catch (e) {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "futur0s3mc0nt3xt0",
};
