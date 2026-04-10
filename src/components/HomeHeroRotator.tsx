"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [imageIndex, setImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchDeltaRef = useRef(0);

  useEffect(() => {
    if (heroItems.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % heroItems.length);
        setIsTransitioning(false);
      }, 160);
    }, 6500);

    return () => clearInterval(interval);
  }, [heroItems.length]);

  useEffect(() => {
    if (index >= heroItems.length) setIndex(0);
    setImageIndex(0);
  }, [index, heroItems.length]);

  useEffect(() => {
    if (!heroItems.length) return;
    const preloadTargets = [
      heroItems[index],
      heroItems[(index + 1) % heroItems.length],
      heroItems[(index + 2) % heroItems.length],
    ].filter(Boolean);

    preloadTargets.forEach((item) => {
      const url = buildImageCandidates(item.bannerImage, item.coverImage)[0];
      if (!url) return;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
  }, [heroItems, index]);

  const go = (direction: "prev" | "next") => {
    if (heroItems.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setIndex((prev) => {
        if (direction === "prev") return (prev - 1 + heroItems.length) % heroItems.length;
        return (prev + 1) % heroItems.length;
      });
      setIsTransitioning(false);
    }, 160);
  };

  const onTouchStart = (x: number) => {
    touchStartRef.current = x;
    touchDeltaRef.current = 0;
  };

  const onTouchMove = (x: number) => {
    if (touchStartRef.current === null) return;
    touchDeltaRef.current = x - touchStartRef.current;
  };

  const onTouchEnd = () => {
    if (touchStartRef.current === null) return;
    const delta = touchDeltaRef.current;
    if (Math.abs(delta) >= 42) {
      go(delta < 0 ? "next" : "prev");
    }
    touchStartRef.current = null;
    touchDeltaRef.current = 0;
  };

  if (!heroItems.length) return null;

  const active = heroItems[index];
  const imageCandidates = buildImageCandidates(active.bannerImage, active.coverImage);
  const heroImage = imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)] || "/logo.png";

  const avgRating = active.ratings?.length
    ? (active.ratings.reduce((sum, rating) => sum + rating.rating, 0) / active.ratings.length).toFixed(1)
    : null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/12 bg-[var(--surface-0)]"
      onTouchStart={(event) => onTouchStart(event.touches[0]?.clientX ?? 0)}
      onTouchMove={(event) => onTouchMove(event.touches[0]?.clientX ?? 0)}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-[16/11] sm:aspect-[16/8] lg:aspect-[16/6] min-h-[22rem] sm:min-h-[24rem]">
        <img
          src={heroImage}
          alt={active.title || "Destaque"}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
            isTransitioning ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100"
          }`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={() => {
            const next = imageIndex + 1;
            if (next < imageCandidates.length) {
              setImageIndex(next);
            }
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[var(--hero-overlay-bottom)] via-[var(--hero-overlay-mid)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--hero-overlay-side)] via-[var(--hero-overlay-side-mid)] to-transparent" />

        <div className="relative z-10 flex h-full items-end px-4 sm:px-6 lg:px-8 pb-6 sm:pb-7">
          <div className="w-full max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/24 bg-black/55 px-3 py-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff454f]">Agora no Futuro</span>
              {avgRating ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-300">
                  <Star size={11} className="fill-yellow-300 text-yellow-300" />
                  {avgRating}
                </span>
              ) : null}
            </div>

            <h1 className="text-[1.9rem] sm:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95] text-white">
              {active.title}
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-[var(--text-secondary)] line-clamp-2 sm:line-clamp-3">
              {active.description || "Um novo visual com experiencia limpa, foco em descoberta e maratona sem ruido."}
            </p>

            {active.categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {active.categories.slice(0, 4).map((category) => (
                  <span key={category.id} className="kdr-badge">
                    {category.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2.5 pt-1">
              <Link prefetch={true} href={active.watchHref} className="kdr-btn-primary h-11 px-5 text-sm">
                <Play size={16} fill="currentColor" /> Assistir agora
              </Link>
              <Link prefetch={true} href={`/anime/${active.id}`} className="kdr-btn-secondary h-11 px-5 text-sm">
                Abrir pagina
              </Link>
            </div>
          </div>
        </div>

        {heroItems.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go("prev")}
              aria-label="Destaque anterior"
              className="hidden sm:inline-flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full border border-white/24 bg-black/62 text-white hover:bg-black/82 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go("next")}
              aria-label="Proximo destaque"
              className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full border border-white/24 bg-black/62 text-white hover:bg-black/82 transition"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : null}
      </div>

      {heroItems.length > 1 ? (
        <div className="border-t border-white/10 bg-[var(--surface-1)] px-3 sm:px-5 py-3">
          <div className="flex items-center gap-2">
            {heroItems.map((item, dotIndex) => {
              const activeDot = dotIndex === index;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Ir para ${item.title}`}
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setIndex(dotIndex);
                      setIsTransitioning(false);
                    }, 140);
                  }}
                  className={`h-1.5 rounded-full transition-all ${activeDot ? "w-7 bg-[#ff3b45]" : "w-3 bg-white/25 hover:bg-white/45"}`}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
