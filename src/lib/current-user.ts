import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isBanActive } from "@/lib/ban";
import prisma from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const userId = (session.user as any)?.id as string | undefined;
  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { settings: true },
      });
      if (user) return isBanActive(user) ?null : user;
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { settings: true },
    });
    return isBanActive(user) ?null : user;
  } catch {
    return null;
  }
}
