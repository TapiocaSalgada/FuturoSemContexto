import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const userId = (session.user as any)?.id as string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });
    if (user) return user;
  }

  return prisma.user.findUnique({
    where: { email: session.user.email },
    include: { settings: true },
  });
}
