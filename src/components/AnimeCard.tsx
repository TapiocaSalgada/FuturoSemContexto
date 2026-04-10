"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play, Star } from "lucide-react";

import { buildImageCandidates } from "@/lib/image-quality";

interface AnimeCardProps {
  href: string;
  title: string;
  image?: string | null;
  badgeTopLeft?: React.ReactNode;
  overlayText?: React.ReactNode;
  subTitle?: React.ReactNode;
  rating?: number | null;
  hideTitle?: boolean;
  className?: string;
}

export default function AnimeCard({
  href,
  title,
  image,
  badgeTopLeft,
  overlayText,
  subTitle,
  rating,
  hideTitle = false,
  className = "",
}: AnimeCardProps) {
  const hasImage = Boolean(image);
  const imageCandidates = useMemo(() => buildImageCandidates(image), [image]);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [image]);

  const currentImage = imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)] || "/logo.png";

  return (
    <Link prefetch={true} href={href} className={`group block shrink-0 snap-start ${className}`}>
      <article className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/12 bg-[var(--surface-1)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-white/35 group-hover:shadow-[0_26px_45px_rgba(0,0,0,0.62)] group-active:scale-[0.985]">
        {hasImage ? (
          <img
            src={currentImage}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            loading="lazy"
            onError={() => {
              const nextIndex = imageIndex + 1;
              if (nextIndex < imageCandidates.length) {
                setImageIndex(nextIndex);
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1f2028] to-[#0f1014]">
            <Play size={30} className="text-white/55" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/36 to-transparent" />

        {badgeTopLeft ? <div className="absolute left-2.5 top-2.5 z-10">{badgeTopLeft}</div> : null}

        {typeof rating === "number" && rating > 0 ? (
          <div className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/62 px-2 py-1">
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] font-bold text-white">{rating.toFixed(1)}</span>
          </div>
        ) : null}

        {overlayText ? (
          <div className="absolute bottom-12 left-2.5 right-2.5 z-10">
            <div className="inline-flex rounded-full border border-white/16 bg-black/62 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/92">
              {overlayText}
            </div>
          </div>
        ) : null}

        {!hideTitle ? (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
            <p className="truncate text-[12px] font-extrabold tracking-[0.01em] text-white drop-shadow">{title}</p>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-250 group-hover:opacity-100">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-black shadow-lg">
            <Play size={17} className="ml-0.5" fill="currentColor" />
          </span>
        </div>
      </article>

      {subTitle ? <div className="mt-2 truncate px-0.5 text-[11px] text-[var(--text-muted)]">{subTitle}</div> : null}
    </Link>
  );
}
