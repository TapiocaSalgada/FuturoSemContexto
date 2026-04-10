"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Trash2 } from "lucide-react";

import HorizontalCarousel from "@/components/HorizontalCarousel";
import { buildImageCandidates } from "@/lib/image-quality";

type ContinueItem = {
  id: string;
  progressSec: number;
  episode?: {
    id: string;
    number: number;
    season: number;
    thumbnailUrl?: string | null;
    anime?: {
      id: string;
      title: string;
      coverImage?: string | null;
      bannerImage?: string | null;
      visibility?: string;
    };
  };
};

export default function ContinueWatchingRail({ items }: { items: ContinueItem[] }) {
  const [list, setList] = useState(items || []);
  const [removing, setRemoving] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      (list || []).filter((history) => {
        const visibility = history.episode?.anime?.visibility;
        return !visibility || visibility === "public";
      }),
    [list],
  );

  const removeItem = async (animeId?: string) => {
    if (!animeId || removing) return;
    setRemoving(animeId);

    try {
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId }),
      });
      setList((prev) => prev.filter((entry) => entry.episode?.anime?.id !== animeId));
    } catch {
      // Keep silent to avoid disrupting watch flow
    } finally {
      setRemoving(null);
    }
  };

  if (!visible.length) return null;

  return (
    <section className="animate-fadeInUp rounded-2xl border border-white/10 bg-[var(--surface-1)] p-4 sm:p-5 lg:p-6">
      <h2 className="kdr-section-title mb-1.5">
        <Play size={16} className="kdr-section-title-accent" /> Continue assistindo
      </h2>
      <p className="mb-4 text-[11px] text-[var(--text-muted)]">Retome sem perder o ritmo.</p>

      <HorizontalCarousel>
        {visible.map((history) => {
          const anime = history.episode?.anime;
          if (!anime || !history.episode) return null;

          const imageCandidates = buildImageCandidates(
            history.episode.thumbnailUrl,
            history.episode.anime?.bannerImage,
            anime.coverImage,
          );

          const image = imageCandidates[0] || "/logo.png";
          const isRemoving = removing === anime.id;
          const progress = Math.max(
            8,
            Math.min(98, Math.round((history.progressSec / Math.max(history.progressSec + 300, 900)) * 100)),
          );

          return (
            <article
              key={history.id}
              className={`w-[178px] sm:w-[205px] lg:w-[228px] shrink-0 snap-start ${isRemoving ? "opacity-45" : ""}`}
            >
              <Link prefetch={true} href={`/watch/${history.episode.id}`} className="group block">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/14 bg-[var(--surface-0)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/30 group-hover:shadow-[0_18px_38px_rgba(0,0,0,0.5)]">
                  <img
                    src={image}
                    alt={anime.title}
                    className="absolute inset-0 h-full w-full object-cover opacity-88 transition-all duration-500 group-hover:scale-[1.05] group-hover:opacity-100"
                    loading="lazy"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/22 to-transparent" />

                  <div className="absolute left-2 top-2 rounded-full border border-white/18 bg-black/62 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-white">
                    T{history.episode.season} EP{history.episode.number}
                  </div>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-250 group-hover:opacity-100">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white text-black shadow-lg">
                      <Play size={15} className="ml-0.5" fill="currentColor" />
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/12">
                    <div
                      className="h-full rounded-r-full"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(90deg,#8f67ff 0%,#5536d9 100%)",
                      }}
                    />
                  </div>
                </div>
              </Link>

              <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                <p className="min-w-0 truncate text-[12px] font-semibold text-white">{anime.title}</p>
                <button
                  onClick={() => removeItem(anime.id)}
                  disabled={isRemoving}
                  title="Remover"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-purple-500/12 hover:text-purple-300 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </article>
          );
        })}
      </HorizontalCarousel>
    </section>
  );
}
