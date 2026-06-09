import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Clock, Heart, ListVideo } from "lucide-react";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/catalog/EmptyState";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCurrentUser } from "@/lib/current-user";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

function activeTab(value: string | undefined) {
  if (value === "listas" || value === "historico") return value;
  return "watchlist";
}

export default async function MinhaListaPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tab = activeTab(searchParams.tab);
  const [favorites, history, canonicalWatchlist, canonicalProgress] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId: user.id, anime: { visibility: "public" } },
      include: {
        anime: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            bannerImage: true,
            description: true,
            episodes: { where: { status: "published" }, select: { id: true, title: true, number: true }, take: 1, orderBy: { number: "asc" } },
          },
        },
        folder: { select: { id: true, name: true, isPrivate: true } },
      },
      orderBy: { id: "desc" },
      take: 80,
    }),
    prisma.watchHistory.findMany({
      where: { userId: user.id, episode: { anime: { visibility: "public" } } },
      include: { episode: { include: { anime: { select: { id: true, slug: true, title: true, coverImage: true, bannerImage: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    prisma.watchlist.findMany({
      where: { userId: user.id, content: { status: { in: ["public", "published"] } } },
      include: { content: { select: { id: true, slug: true, title: true, posterUrl: true, bannerUrl: true, synopsis: true } }, folder: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }).catch(() => []),
    prisma.watchProgress.findMany({
      where: { userId: user.id, content: { status: { in: ["public", "published"] } } },
      include: { content: true, episode: true },
      orderBy: { lastWatchedAt: "desc" },
      take: 80,
    }).catch(() => []),
  ]);

  return (
    <AppShell>
      <main className="stack-page app-list-page">
        <section className="compact-hero">
          <p className="eyebrow"><Bookmark aria-hidden size={16} /> Minha lista</p>
          <h1>Seu canto para continuar assistindo.</h1>
          <p>Watchlist, listas e histórico ficam juntos, sem downloads falsos ou abas sem suporte real.</p>
        </section>

        <nav className="tab-strip list-tabs" aria-label="Minha lista">
          <Link className={tab === "watchlist" ? "tab-pill active" : "tab-pill"} href="/minha-lista">Watchlist</Link>
          <Link className={tab === "listas" ? "tab-pill active" : "tab-pill"} href="/minha-lista?tab=listas">Listas</Link>
          <Link className={tab === "historico" ? "tab-pill active" : "tab-pill"} href="/minha-lista?tab=historico">Histórico</Link>
        </nav>

        {tab === "watchlist" ? (
          favorites.length + canonicalWatchlist.length === 0 ? (
            <EmptyState title="Nada salvo ainda" body="Abra um anime e toque em Minha Lista para guardar aqui." />
          ) : (
            <section className="library-list">
              {canonicalWatchlist.map((item) => (
                <article className="library-row" key={`content:${item.id}`}>
                  <FallbackImage src={item.content.posterUrl || item.content.bannerUrl} alt={item.content.title} fallbackLabel={item.content.title} />
                  <div>
                    <strong>{item.content.title}</strong>
                    <p>{item.content.synopsis || "Conteúdo salvo na sua watchlist."}</p>
                    {item.folder?.name ? <small>{item.folder.name}</small> : null}
                  </div>
                  <div className="row-actions"><Link className="secondary-action" href={`/anime/${encodeURIComponent(item.content.slug || item.content.id)}`}>Detalhes</Link></div>
                </article>
              ))}
              {favorites.map((favorite) => (
                <article className="library-row" key={`anime:${favorite.id}`}>
                  <FallbackImage src={favorite.anime.coverImage || favorite.anime.bannerImage} alt={favorite.anime.title} fallbackLabel={favorite.anime.title} />
                  <div>
                    <strong>{favorite.anime.title}</strong>
                    <p>{favorite.anime.description || "Título salvo na sua watchlist."}</p>
                    {favorite.folder?.name ? <small>{favorite.folder.name}</small> : null}
                  </div>
                  <div className="row-actions">
                    <Link className="secondary-action" href={`/anime/${encodeURIComponent(favorite.anime.slug || favorite.anime.id)}`}>Detalhes</Link>
                    {favorite.anime.episodes[0]?.id ? <Link className="primary-action" href={`/assistir/${encodeURIComponent(favorite.anime.slug || favorite.anime.id)}/episodio-${favorite.anime.episodes[0].number}`}>Assistir</Link> : null}
                  </div>
                </article>
              ))}
            </section>
          )
        ) : null}

        {tab === "listas" ? (
          <section className="metric-grid">
            <article className="metric-card"><ListVideo aria-hidden size={22} /><strong>{favorites.length + canonicalWatchlist.length}</strong><span>Itens salvos</span></article>
            <article className="metric-card"><Heart aria-hidden size={22} /><strong>{new Set(favorites.map((item) => item.folder?.name).filter(Boolean)).size}</strong><span>Pastas legadas</span></article>
            <article className="metric-card"><Bookmark aria-hidden size={22} /><strong>{canonicalWatchlist.filter((item) => item.folderId).length}</strong><span>Itens em pastas</span></article>
          </section>
        ) : null}

        {tab === "historico" ? (
          history.length + canonicalProgress.length === 0 ? (
            <EmptyState title="Sem histórico" body="Assista um episódio para ele aparecer aqui." />
          ) : (
            <section className="history-grid">
              {canonicalProgress.map((item) => (
                <article className="history-card" key={`progress:${item.id}`}>
                  <FallbackImage src={item.episode.thumbnailUrl || item.content.posterUrl || item.content.bannerUrl} alt={item.episode.title} fallbackLabel={item.episode.title} />
                  <strong>{item.content.title}</strong>
                  <span>{item.completed ? "Concluído" : `${Math.floor(item.progressSeconds / 60)} min assistidos`}</span>
                  <Link className="secondary-action" href={`/assistir/${encodeURIComponent(item.content.slug)}/${encodeURIComponent(item.episode.slug || item.episode.id)}`}>Retomar</Link>
                </article>
              ))}
              {history.map((item) => (
                <article className="history-card" key={`history:${item.id}`}>
                  <FallbackImage src={item.episode.thumbnailUrl || item.episode.anime.coverImage || item.episode.anime.bannerImage} alt={item.episode.title} fallbackLabel={item.episode.title} />
                  <strong>{item.episode.anime.title}</strong>
                  <span>{item.watched ? "Concluído" : `${Math.floor(Number(item.progressSec || 0) / 60)} min assistidos`}</span>
                  <Link className="secondary-action" href={`/assistir/${encodeURIComponent(item.episode.anime.slug || item.episode.anime.id)}/episodio-${item.episode.number}`}>Retomar</Link>
                </article>
              ))}
            </section>
          )
        ) : null}
      </main>
    </AppShell>
  );
}
