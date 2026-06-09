import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Layers3, PlayCircle, Star } from "lucide-react";

import AppShell from "@/components/AppShell";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCatalogDetail } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function AnimeDetailPage({ params }: { params: { id: string } }) {
  const detail = await getCatalogDetail(params.id);
  if (!detail) notFound();

  const grouped = detail.episodes.reduce<Record<number, typeof detail.episodes>>((acc, episode) => {
    const season = episode.seasonNumber || 1;
    acc[season] = acc[season] || [];
    acc[season].push(episode);
    return acc;
  }, {});

  const firstPlayable = detail.episodes.find((episode) => episode.watchHref);

  return (
    <AppShell>
      <article className="detail-page">
        <section className="detail-hero app-detail-hero">
          <FallbackImage src={detail.bannerUrl || detail.posterUrl} alt={detail.title} fallbackLabel={detail.title} className="detail-backdrop" />
          <div className="hero-scrim" />
          <div className="detail-content">
            <FallbackImage src={detail.posterUrl} alt={detail.title} fallbackLabel={detail.title} className="detail-poster" />
            <div>
              <p className="eyebrow">{detail.kind || "Anime"}</p>
              <h1>{detail.title}</h1>
              <p>{detail.synopsis || "Sinopse em preparação."}</p>
              <div className="meta-row">
                <span><PlayCircle aria-hidden size={16} />{detail.episodeCount} episódios</span>
                {detail.year ? <span><CalendarDays aria-hidden size={16} />{detail.year}</span> : null}
                <span><Star aria-hidden size={16} />{detail.matchScore}% match</span>
              </div>
              <div className="hero-actions">
                {firstPlayable?.watchHref ? <Link className="primary-action" href={firstPlayable.watchHref}><PlayCircle aria-hidden size={18} /> Assistir agora</Link> : <span className="secondary-action disabled">Sem episódio publicado</span>}
                <FavoriteButton animeId={detail.id} enabled={detail.source === "legacy"} />
                <Link className="secondary-action" href={`/anime/${encodeURIComponent(detail.slug)}/temporadas`}><Layers3 aria-hidden size={18} /> Temporadas</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="episodes-section">
          <div className="section-heading">
            <div><h2>Episódios</h2><p>Temporadas publicadas e fontes resolvidas pelo player.</p></div>
            <div className="row-actions"><Link className="secondary-action" href={`/anime/${encodeURIComponent(detail.slug)}/temporadas`}>Ver temporadas</Link><Link className="secondary-action" href={`/anime/${encodeURIComponent(detail.slug)}/episodios`}>Todos episódios</Link></div>
          </div>
          {Object.entries(grouped).length === 0 ? (
            <div className="status-card">Nenhum episódio publicado ainda.</div>
          ) : (
            Object.entries(grouped).map(([season, episodes]) => (
              <div className="season-block" key={season}>
                <h3>Temporada {season}</h3>
                <div className="episode-list">
                  {episodes.slice(0, 8).map((episode) => (
                    <article className="episode-row" key={`${episode.source}:${episode.id}`}>
                      <FallbackImage src={episode.thumbnailUrl || detail.bannerUrl || detail.posterUrl} alt={episode.title} fallbackLabel={episode.title} />
                      <div>
                        <strong>{episode.episodeNumber}. {episode.title}</strong>
                        <p>{episode.synopsis || "Episódio publicado."}</p>
                        {episode.durationLabel ? <small><Clock aria-hidden size={14} />{episode.durationLabel}</small> : null}
                      </div>
                      {episode.watchHref ? <Link className="secondary-action" href={episode.watchHref}>Assistir</Link> : <span className="source-pill">Sem fonte</span>}
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </article>
    </AppShell>
  );
}
