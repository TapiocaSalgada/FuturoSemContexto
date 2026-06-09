import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetId = params.id;
  if (!targetId) return NextResponse.json({ error: "Usuário obrigatório." }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: targetId },
    data: {
      banned: false,
      banReason: null,
      bannedAt: null,
      bannedUntil: null,
      bannedById: null,
    },
    select: { id: true, name: true, email: true, banned: true, banReason: true, bannedAt: true, bannedUntil: true },
  });

  return NextResponse.json({ user });
}
