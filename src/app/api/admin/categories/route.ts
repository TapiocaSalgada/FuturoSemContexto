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

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const categories = await prisma.category.findMany({
      include: { _count: { select: { animes: true } } },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(categories);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { name } = await req.json();
    if (!name?.trim()) return new NextResponse("Nome da categoria é obrigatório", { status: 400 });

    const slug = generateSlug(name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    
    if (existing) {
      return new NextResponse("Categoria já existe", { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name: name.trim(), slug }
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Category Create Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await req.json();
    if (!id) return new NextResponse("ID obrigatório", { status: 400 });

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Category Delete Error", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
