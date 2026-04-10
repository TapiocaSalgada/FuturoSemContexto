import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!name || !email || !password) {
      return new NextResponse("Missing data", { status: 400 });
    }

    if (password.length < 6) {
      return new NextResponse("Password must have at least 6 characters", { status: 400 });
    }

    const exist = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (exist) {
      return new NextResponse("Email already exists", { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Make the first registered user an Admin
    const usersCount = await prisma.user.count();
    const role = usersCount === 0 ? "admin" : "user";

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (/lastactiveat/i.test(message) || /column .* does not exist/i.test(message)) {
      return new NextResponse("Database schema out of sync", { status: 500 });
    }

    if (error?.code === "P2002") {
      return new NextResponse("Email already exists", { status: 400 });
    }

    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
/**
 * Account registration endpoint.
 */
