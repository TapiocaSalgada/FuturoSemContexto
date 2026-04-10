import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword, confirmEmail } = await req.json();
    if (!currentPassword || !newPassword || !confirmEmail) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    if (confirmEmail !== session.user.email) return NextResponse.json({ error: "E-mail de confirmação incorreto." }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: "Nova senha deve ter mínimo 6 caracteres." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "Senha não encontrada." }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Change Password Error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
/**
 * Profile password change endpoint.
 */
