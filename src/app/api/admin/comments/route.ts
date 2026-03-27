import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        anime: { select: { id: true, title: true } }
      }
    });
    
    return NextResponse.json(comments);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await req.json();
    if (!id) return new NextResponse("ID obrigatório", { status: 400 });

    await prisma.comment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Comment Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
