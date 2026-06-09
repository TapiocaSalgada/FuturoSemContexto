import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/admin-access";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSiteAdmin(session as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [animes, episodes, users, bugs, suggestions] = await Promise.all([
    prisma.anime.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true, mediaType: true }, take: 6 }),
    prisma.episode.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true, season: true, number: true, animeId: true, anime: { select: { title: true } } }, take: 6 }),
    prisma.user.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, select: { id: true, name: true, email: true, role: true }, take: 5 }),
    prisma.bugReport.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true, status: true }, take: 5 }),
    prisma.suggestion.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true, status: true }, take: 5 }),
  ]);

  const results = [
    ...animes.map((item) => ({ type: "Conteudo", id: item.id, title: item.title, subtitle: item.mediaType || "anime", href: `/admin/catalogo?q=${encodeURIComponent(item.title)}` })),
    ...episodes.map((item) => ({ type: "Episodio", id: item.id, title: item.title, subtitle: `${item.anime.title} T${item.season}E${item.number}`, href: `/admin/episodios?animeId=${item.animeId}&episodeId=${item.id}` })),
    ...users.map((item) => ({ type: "Usuario", id: item.id, title: item.name, subtitle: `${item.email} / ${item.role}`, href: `/admin/usuarios?q=${encodeURIComponent(item.email)}` })),
    ...bugs.map((item) => ({ type: "Bug", id: item.id, title: item.title, subtitle: item.status, href: `/admin/bugs?status=${encodeURIComponent(item.status)}` })),
    ...suggestions.map((item) => ({ type: "Sugestao", id: item.id, title: item.title, subtitle: item.status, href: `/admin/sugestoes?status=${encodeURIComponent(item.status)}` })),
  ];

  return NextResponse.json({ results: results.slice(0, 18) });
}
