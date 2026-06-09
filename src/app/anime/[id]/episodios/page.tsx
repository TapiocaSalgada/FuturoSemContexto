import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, PlayCircle } from "lucide-react";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/catalog/EmptyState";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCatalogDetail } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function AnimeEpisodesPage({ params, searchParams }: { params: { id: string }; searchParams: { temporada?: string } }) {
  const detail = await getCatalogDetail(params.id);
  if (!detail) notFound();
  const seasonFilter = Number(searchParams.temporada || 0);
  const episodes = seasonFilter > 0 ? detail.episodes.filter((episode) => episode.seasonNumber === seasonFilter) : detail.episodes;

  return (
    <AppShell>
      <main className="stack-page">
        <section className="compact-hero">
          <p className="eyebrow"><PlayCircle aria-hidden size={16} /> Episódios</p>
          <h1>{seasonFilter ? `Temporada ${seasonFilter}` : detail.title}</h1>
          <p>{episodes.length} episódios encontrados.</p>
          <Link className="secondary-action" href={`/anime/${encodeURIComponent(detail.slug)}`}><ChevronLeft aria-hidden size={18} /> Voltar ao anime</Link>
        </section>
        {episodes.length === 0 ? <EmptyState title="Sem episódios" body="Nenhum episódio publicado nesta seleção." /> : (
          <section className="episode-list full-list">
            {episodes.map((episode) => (
              <article className="episode-row" key={`${episode.source}:${episode.id}`}>
                <FallbackImage src={episode.thumbnailUrl || detail.bannerUrl || detail.posterUrl} alt={episode.title} fallbackLabel={episode.title} />
                <div><strong>T{episode.seasonNumber} E{episode.episodeNumber} - {episode.title}</strong><p>{episode.synopsis || "Episódio publicado."}</p>{episode.durationLabel ? <small><Clock aria-hidden size={14} />{episode.durationLabel}</small> : null}</div>
                {episode.watchHref ? <Link className="primary-action" href={episode.watchHref}>Assistir</Link> : <span className="source-pill">Sem fonte</span>}
              </article>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}
