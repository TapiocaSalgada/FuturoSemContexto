import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Layers3 } from "lucide-react";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/catalog/EmptyState";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCatalogDetail } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function AnimeSeasonsPage({ params }: { params: { id: string } }) {
  const detail = await getCatalogDetail(params.id);
  if (!detail) notFound();

  return (
    <AppShell>
      <main className="stack-page">
        <section className="compact-hero">
          <p className="eyebrow"><Layers3 aria-hidden size={16} /> Temporadas</p>
          <h1>{detail.title}</h1>
          <p>Escolha uma temporada para navegar pelos episódios publicados.</p>
          <Link className="secondary-action" href={`/anime/${encodeURIComponent(detail.slug)}`}><ChevronLeft aria-hidden size={18} /> Voltar ao anime</Link>
        </section>
        {detail.seasons.length === 0 ? <EmptyState title="Sem temporadas" body="Este título ainda não tem temporadas publicadas." /> : (
          <section className="library-list">
            {detail.seasons.map((season) => {
              const total = detail.episodes.filter((episode) => episode.seasonNumber === season.number).length;
              return (
                <article className="library-row" key={season.id}>
                  <FallbackImage src={detail.posterUrl || detail.bannerUrl} alt={season.title} fallbackLabel={season.title} />
                  <div><strong>{season.title}</strong><p>{season.synopsis || `Temporada ${season.number}`}</p><small>{total} episódios</small></div>
                  <Link className="primary-action" href={`/anime/${encodeURIComponent(detail.slug)}/episodios?temporada=${season.number}`}>Abrir</Link>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </AppShell>
  );
}
