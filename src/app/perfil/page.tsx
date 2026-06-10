import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Edit3, History, Shield, User } from "lucide-react";

import AppShell from "@/components/AppShell";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCurrentUser } from "@/lib/current-user";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [historyCount, favoriteCount, sessions, events] = await Promise.all([
    prisma.watchHistory.count({ where: { userId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.accountSession.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" }, take: 3 }).catch(() => []),
    prisma.securityEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
  ]);

  return (
    <AppShell>
      <main className="profile-page">
        <section className="profile-hero">
          <FallbackImage src={user.bannerUrl} alt="Banner do perfil" fallbackLabel={user.name || "FSC"} className="profile-banner" />
          <div className="profile-card">
            <FallbackImage src={user.avatarUrl} alt={user.name || "Perfil"} fallbackLabel={user.name || "FS"} className="profile-avatar" />
            <div>
              <p className="eyebrow"><User aria-hidden size={16} /> Perfil</p>
              <h1>{user.name}</h1>
              <p>{user.username ? `@${user.username}` : "Defina um username para compartilhar seu perfil."}</p>
              <p>{user.bio || "Este usuário ainda não escreveu uma bio."}</p>
            </div>
            <Link className="primary-action" href="/perfil/editar"><Edit3 aria-hidden size={18} /> Editar</Link>
          </div>
        </section>

        <section className="metric-grid">
          <article className="metric-card"><History aria-hidden size={22} /><strong>{historyCount}</strong><span>Histórico</span></article>
          <article className="metric-card"><CalendarDays aria-hidden size={22} /><strong>{favoriteCount}</strong><span>Favoritos</span></article>
          <article className="metric-card"><Shield aria-hidden size={22} /><strong>{sessions.length}</strong><span>Sessões recentes</span></article>
        </section>


      </main>
    </AppShell>
  );
}
