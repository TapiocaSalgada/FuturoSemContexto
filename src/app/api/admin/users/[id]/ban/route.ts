import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isOwnerEmail, isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

function parseBanUntil(type: unknown, value: unknown) {
  if (String(type || "permanent") !== "temporary") return null;
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetId = params.id;
  const requestorId = String((session?.user as any)?.id || "");
  const requestorEmail = String(session?.user?.email || "");
  if (!targetId) return NextResponse.json({ error: "Usuário obrigatório." }, { status: 400 });
  if (targetId === requestorId) return NextResponse.json({ error: "Você não pode banir sua própria conta." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();
  if (reason.length < 3) return NextResponse.json({ error: "Informe o motivo do banimento." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (isOwnerEmail(target.email)) return NextResponse.json({ error: "Não é permitido banir o dono do site." }, { status: 403 });
  if (target.role === "admin") return NextResponse.json({ error: "Por segurança, admins não podem ser banidos por esta tela." }, { status: 403 });

  const bannedUntil = parseBanUntil(body?.type, body?.bannedUntil);
  if (String(body?.type || "permanent") === "temporary" && !bannedUntil) {
    return NextResponse.json({ error: "Escolha uma data futura para o banimento temporário." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: {
      banned: true,
      banReason: reason,
      bannedAt: new Date(),
      bannedUntil,
      bannedById: requestorId || null,
    },
    select: { id: true, name: true, email: true, banned: true, banReason: true, bannedAt: true, bannedUntil: true },
  });

  return NextResponse.json({ user, bannedBy: requestorEmail });
}
