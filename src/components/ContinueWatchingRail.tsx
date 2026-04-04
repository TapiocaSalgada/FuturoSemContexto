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
      (list || []).filter((h) => {
        const vis = h.episode?.anime?.visibility;
        return !vis || vis === "public";
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
      setList((prev) => prev.filter((x) => x.episode?.anime?.id !== animeId));
    } catch {
      // Silently fail
    } finally {
      setRemoving(null);
    }
  };

  if (!visible.length) return null;

  return (
    <section className="animate-fadeInUp rounded-3xl border border-white/10 bg-black/[0.22] p-4 sm:p-5 lg:p-6">
      <h2 className="kdr-section-title mb-2">
        <Play size={16} className="kdr-section-title-accent" /> Continue assistindo
      </h2>
      <p className="text-[11px] text-[var(--text-muted)] mb-4">Retome do ponto onde você parou, sem perder progresso.</p>
      <HorizontalCarousel>
        {visible.map((history) => {
          const anime = history.episode?.anime;
          if (!anime || !history.episode) return null;
          const isRemoving = removing === anime.id;
          const imageCandidates = buildImageCandidates(
            history.episode?.thumbnailUrl,
            history.episode?.anime?.bannerImage,
            anime.coverImage,
          );
          const initialImage = imageCandidates[0] || "/logo.png";
          const encodedCandidates = imageCandidates.join("||");
          return (
            <div key={history.id} className={`w-[170px] sm:w-[195px] lg:w-[230px] shrink-0 snap-start group transition-opacity ${isRemoving ? "opacity-40" : ""}`}>
              <Link prefetch={true} href={`/watch/${history.episode.id}`} className="block">
                <div className="aspect-video rounded-2xl overflow-hidden relative border border-[var(--border-subtle)] group-hover:border-[var(--border-strong)] transition-all duration-300 bg-[var(--bg-card)] group-hover:shadow-[0_12px_36px_rgba(0,0,0,0.50)]">
                  <img
                    src={initialImage}
                    data-candidates={encodedCandidates}
                    data-candidate-index="0"
                    className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    alt={anime.title}
                    loading="lazy"
                    onError={(event) => {
                      const target = event.currentTarget;
                      const candidates = String(target.dataset.candidates || "")
                        .split("||")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      const currentIndex = Number(target.dataset.candidateIndex || "0");
                      const nextIndex = Number.isFinite(currentIndex) ? currentIndex + 1 : 1;
                      if (nextIndex < candidates.length) {
                        target.dataset.candidateIndex = String(nextIndex);
                        target.src = candidates[nextIndex];
                      }
                    }}
                  />
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play size={18} className="ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  {/* Season/Ep badge */}
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">T{history.episode.season} EP{history.episode.number}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                    <div
                      className="h-full rounded-r-full transition-all duration-300"
                      style={{
                        backgroundColor: "var(--accent)",
                        boxShadow: `0 0 8px var(--accent-glow)`,
                        width: `${Math.max(
                          10,
                          Math.min(
                            98,
                            Math.round((history.progressSec / Math.max(history.progressSec + 300, 900)) * 100),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>

              <div className="flex items-center justify-between gap-2 mt-2 px-0.5">
                <div className="min-w-0">
                  <p className="text-[12px] text-white font-bold truncate">{anime.title}</p>
                </div>
                <button
                  onClick={() => removeItem(anime.id)}
                  disabled={isRemoving}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition shrink-0 disabled:opacity-40"
                  title="Remover do continue assistindo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </HorizontalCarousel>
    </section>
  );
}
