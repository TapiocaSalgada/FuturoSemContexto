"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";

import { buildImageCandidates } from "@/lib/image-quality";

type HeroItem = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  watchHref: string;
  categories?: { id: string; name: string }[];
  ratings?: { rating: number }[];
};

export default function HomeHeroRotator({ items }: { items: HeroItem[] }) {
  const heroItems = useMemo(() => items.slice(0, 8), [items]);
  const [index, setIndex] = useState(0);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (heroItems.length <= 1) return;
    setIndex(Math.floor(Math.random() * heroItems.length));
  }, [heroItems.length]);

  useEffect(() => {
    if (heroItems.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % heroItems.length);
        setIsTransitioning(false);
      }, 300);
    }, 7000);
    return () => clearInterval(interval);
  }, [heroItems.length]);

  useEffect(() => {
    if (index >= heroItems.length) setIndex(0);
  }, [index, heroItems.length]);

  useEffect(() => {
    setHeroImageIndex(0);
  }, [index, heroItems.length]);

  if (heroItems.length === 0) return null;

  const active = heroItems[index];
  const heroImageCandidates = buildImageCandidates(active.bannerImage, active.coverImage);
  const heroImage =
    heroImageCandidates[Math.min(heroImageIndex, heroImageCandidates.length - 1)] ||
    heroImageCandidates[0];

  const go = (direction: "prev" | "next") => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIndex((prev) => {
        if (direction === "prev") return (prev - 1 + heroItems.length) % heroItems.length;
        return (prev + 1) % heroItems.length;
      });
      setIsTransitioning(false);
    }, 250);
  };

  const sideItems = heroItems.length
    ? Array.from({ length: Math.min(3, heroItems.length) }, (_, offset) => {
        const targetIndex = (index + offset) % heroItems.length;
        return { item: heroItems[targetIndex], targetIndex };
      })
    : [];

  const avgRating = active.ratings?.length
    ? (active.ratings.reduce((s, r) => s + r.rating, 0) / active.ratings.length).toFixed(1)
    : null;

  return (
    <section className="relative w-full flex flex-col justify-end overflow-hidden aspect-[16/11] sm:aspect-[16/8] lg:aspect-[16/6] min-h-[22rem] sm:min-h-[28rem] lg:min-h-[34rem]">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-700 ease-out ${isTransitioning ? "opacity-0 scale-[1.04]" : "opacity-100 scale-100"} [filter:saturate(1.08)_contrast(1.06)_brightness(0.72)]`}
          alt={active.title || "Destaque"}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={() => {
            setHeroImageIndex((prev) =>
              prev + 1 < heroImageCandidates.length ? prev + 1 : prev,
            );
          }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/58 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)]/86 via-[var(--background)]/36 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_30%,var(--background)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 lg:gap-10 items-end px-5 sm:px-6 lg:px-10 pb-8 lg:pb-12">
        <div className={`max-w-3xl space-y-3 sm:space-y-4 transition-all duration-500 ${isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>

          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-white/12 bg-black/45 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
            </span>
            <span className="font-black tracking-[0.18em] text-[10px] sm:text-[11px] uppercase text-[var(--text-accent)]">Sessao principal</span>
            {avgRating && (
              <>
                <span className="w-px h-3 bg-white/15" />
                <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                  <Star size={10} className="fill-yellow-400" /> {avgRating}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-[2.4rem] sm:text-5xl lg:text-7xl font-black tracking-tighter text-white leading-[0.92] break-words"
            style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {active.title}
          </h1>

          {/* Categories */}
          {active.categories && active.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {active.categories.slice(0, 4).map((cat) => (
                <span key={cat.id} className="kdr-badge kdr-badge-accent">{cat.name}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <p className="text-[var(--text-secondary)] text-sm sm:text-[15px] lg:text-base line-clamp-3 max-w-2xl leading-relaxed">
            {active.description || "Seu próximo anime já está pronto para maratonar."}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
            <Link
              prefetch={true}
              href={active.watchHref}
              className="kdr-btn-primary h-12 px-8 text-[15px] sm:text-sm"
            >
              <Play fill="currentColor" size={16} /> Acessar agora
            </Link>
            <Link
              prefetch={true}
              href={`/anime/${active.id}`}
              className="kdr-btn-secondary h-12 px-7 text-[15px] sm:text-sm"
            >
              Detalhes
            </Link>
          </div>

          {/* Navigation */}
          {heroItems.length > 1 && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => go("prev")}
                  className="inline-flex w-11 h-11 rounded-full border border-white/14 bg-black/45 items-center justify-center text-white hover:bg-white/12 transition"
                aria-label="Destaque anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => go("next")}
                  className="inline-flex w-11 h-11 rounded-full border border-white/14 bg-black/45 items-center justify-center text-white hover:bg-white/12 transition"
                aria-label="Próximo destaque"
              >
                <ChevronRight size={18} />
              </button>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5 ml-2">
                {heroItems.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setIndex(itemIndex);
                        setIsTransitioning(false);
                      }, 250);
                    }}
                    className="w-11 h-11 inline-flex items-center justify-center transition-all"
                    aria-label={`Destaque ${itemIndex + 1}`}
                  >
                    <span
                      className={`block h-1 rounded-full transition-all duration-300 ${itemIndex === index ? "w-8 bg-[var(--accent)]" : "w-3 bg-white/25 hover:bg-white/40"}`}
                      style={itemIndex === index ? { boxShadow: `0 0 10px var(--accent-glow)` } : undefined}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side items — Desktop only */}
        {sideItems.length > 1 && (
          <aside className="hidden lg:flex flex-col gap-2.5 pb-2">
            {sideItems.map(({ item, targetIndex }, sideIndex) => {
              const isActive = sideIndex === 0;
              return (
                <button
                  key={`${item.id}-${targetIndex}`}
                  type="button"
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setIndex(targetIndex);
                      setIsTransitioning(false);
                    }, 250);
                  }}
                  className={`text-left rounded-2xl p-3 border transition-all duration-200 ${isActive ? "bg-black/62 border-white/20 shadow-[0_12px_26px_rgba(0,0,0,0.45)]" : "bg-black/40 border-white/[0.08] hover:border-white/18 opacity-72 hover:opacity-100"}`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.coverImage || item.bannerImage || "/logo.png"}
                      alt={item.title}
                      className="w-11 h-[3.5rem] rounded-xl object-cover border border-white/[0.08]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${isActive ? "text-[var(--text-accent)]" : "text-[var(--text-muted)]"}`}>
                        {isActive ? "Em destaque" : "Próximo"}
                      </p>
                      <p className="text-sm font-bold text-white truncate mt-0.5">{item.title}</p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="mt-2.5 h-[3px] rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-[7000ms] ease-linear"
                        style={{
                          width: "100%",
                          backgroundColor: "var(--accent)",
                          boxShadow: "0 0 10px var(--accent-glow)",
                        }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </aside>
        )}
      </div>
    </section>
  );
}
