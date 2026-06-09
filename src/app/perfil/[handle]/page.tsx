import Link from "next/link";
import { notFound } from "next/navigation";
import { User } from "lucide-react";

import AppShell from "@/components/AppShell";
import FallbackImage from "@/components/catalog/FallbackImage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: { handle: string } }) {
  const handle = decodeURIComponent(params.handle || "").replace(/^@/, "");
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: handle }, { id: handle }] },
    include: { settings: true, _count: { select: { followers: true, following: true, favorites: true } } },
  });
  if (!user) notFound();

  const canShow = !user.isPrivate;

  return (
    <AppShell>
      <main className="profile-page">
        <section className="profile-hero">
          <FallbackImage src={user.bannerUrl} alt="Banner do perfil" fallbackLabel={user.name} className="profile-banner" />
          <div className="profile-card">
            <FallbackImage src={user.avatarUrl} alt={user.name} fallbackLabel={user.name} className="profile-avatar" />
            <div>
              <p className="eyebrow"><User aria-hidden size={16} /> Perfil público</p>
              <h1>{user.name}</h1>
              <p>{user.username ? `@${user.username}` : "Sem username"}</p>
              <p>{canShow ? user.bio || "Sem bio." : "Este perfil é privado."}</p>
            </div>
            <Link className="secondary-action" href="/explorar">Explorar</Link>
          </div>
        </section>
        <section className="metric-grid">
          <article className="metric-card"><strong>{canShow ? user._count.favorites : 0}</strong><span>Favoritos públicos</span></article>
          <article className="metric-card"><strong>{user._count.followers}</strong><span>Seguidores</span></article>
          <article className="metric-card"><strong>{user._count.following}</strong><span>Seguindo</span></article>
        </section>
      </main>
    </AppShell>
  );
}
