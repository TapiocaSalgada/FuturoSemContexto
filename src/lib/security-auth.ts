import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isBanActive } from "@/lib/ban";
import prisma from "@/lib/prisma";

export async function requireSecurityUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized" as const, status: 401 as const };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      bannedAt: true,
      bannedUntil: true,
      password: true,
    },
  });

  if (!user) return { error: "Unauthorized" as const, status: 401 as const };
  if (isBanActive(user)) return { error: "Conta suspensa." as const, status: 403 as const };
  return { user };
}
