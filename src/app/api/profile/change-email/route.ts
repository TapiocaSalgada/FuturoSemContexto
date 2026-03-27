import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newEmail } = await req.json();
    if (!currentPassword || !newEmail) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "Senha não encontrada." }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Senha incorreta." }, { status: 400 });

    await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Change Email Error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
