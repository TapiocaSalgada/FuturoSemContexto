import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ownerEmail = String(process.env.OWNER_EMAIL || "relugocruz@gmail.com").trim().toLowerCase();

const publicPrefixes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/banned",
  "/explorar",
  "/buscar",
  "/anime",
];

const privatePrefixes = [
  "/inicio",
  "/minha-lista",
  "/perfil",
  "/configuracoes",
  "/assistir",
  "/watch",
  "/favorites",
  "/history",
  "/profile",
  "/settings",
];

function isAdminToken(token: any) {
  const email = String(token?.email || "").trim().toLowerCase();
  const role = String(token?.role || "").trim().toLowerCase();
  return email === ownerEmail || role === "admin" || role === "owner";
}

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return publicPrefixes.some((prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if ((token as any)?.banned && pathname !== "/banned") {
    const url = req.nextUrl.clone();
    url.pathname = "/banned";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!(token as any)?.banned && pathname === "/banned") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/api/admin")) {
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminToken(token)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    if (!isAdminToken(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/inicio";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPrivatePath(pathname) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) return NextResponse.next();
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/catalog|api/search|api/anime|api/image|_next/static|_next/image|favicon.ico|manifest.json|site.webmanifest|sw.js|.*\\..*).*)",
  ],
};
