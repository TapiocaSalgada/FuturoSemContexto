import Link from "next/link";
import { PlayCircle, Sparkles } from "lucide-react";

import AppShell from "@/components/AppShell";
import CatalogCard from "@/components/catalog/CatalogCard";
import CatalogRail from "@/components/catalog/CatalogRail";
import EmptyState from "@/components/catalog/EmptyState";
import FallbackImage from "@/components/catalog/FallbackImage";
import { getCatalogHomePayload } from "@/lib/catalog/compat";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const payload = await getCatalogHomePayload();
  const hero = payload.hero;

  return (
    <AppShell>
      <div className="stack-page anime-home">
        {hero ? (
          <section className="home-hero app-hero">
            <FallbackImage src={hero.bannerUrl || hero.posterUrl} alt={hero.title} fallbackLabel={hero.title} className="hero-media" />
            <div className="hero-scrim" />
            <div className="hero-content">
              <p className="eyebrow">
                <Sparkles aria-hidden size={16} />
                Destaque
              </p>
              <h1>{hero.title}</h1>
              <p>{hero.synopsis || "Escolha um anime, abra a temporada e assista sem complicação."}</p>
              <div className="hero-actions">
                <Link className="primary-action" href={`/anime/${encodeURIComponent(hero.slug || hero.id)}`}>
                  <PlayCircle aria-hidden size={19} />
                  Assistir
                </Link>
                <Link className="secondary-action" href={`/anime/${encodeURIComponent(hero.slug || hero.id)}`}>
                  Detalhes
                </Link>
              </div>
            </div>
            <div className="hero-stats" aria-label="Resumo do catálogo">
              <span><strong>{payload.stats.titles}</strong> títulos</span>
              <span><strong>{payload.stats.episodes}</strong> episódios</span>
              <span><strong>{payload.stats.sources}</strong> fontes</span>
            </div>
          </section>
        ) : (
          <EmptyState title="Catálogo vazio" body="Importe ou cadastre conteúdos no admin para preencher a home." href="/admin/importar" action="Importar API" />
        )}

        {payload.rails.map((rail) => (
          <CatalogRail key={rail.id} title={rail.title} subtitle={rail.subtitle} items={rail.items} />
        ))}

        {payload.rails.length === 0 && hero ? (
          <section className="catalog-grid">
            <CatalogCard item={hero} priority />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
