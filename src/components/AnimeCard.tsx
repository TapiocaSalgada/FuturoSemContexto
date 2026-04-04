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
    <Link
      prefetch={true}
      href={href}
      className={`block shrink-0 snap-start group ${className}`}
    >
      <div className="aspect-[2/3] rounded-2xl overflow-hidden relative border border-white/[0.06] group-hover:border-white/20 transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)] group-active:scale-[0.97] bg-[var(--bg-card)]">
        {hasImage ? (
            <img
              src={currentImage}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
              loading="lazy"
              onError={(event) => {
                const nextIndex = imageIndex + 1;
                if (nextIndex < imageCandidates.length) {
                  setImageIndex(nextIndex);
                }
              }}
            />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-surface)]">
            <Play size={36} className="text-[var(--text-accent)] opacity-50" />
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg shadow-black/30">
            <Play size={18} className="text-black fill-black ml-0.5" />
          </div>
        </div>

        {/* Badge top left */}
        {badgeTopLeft && (
          <div className="absolute top-2 left-2 z-10">
            {badgeTopLeft}
          </div>
        )}

        {/* Rating badge top right */}
        {typeof rating === "number" && rating > 0 && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-bold text-white">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* Bottom text */}
        <div className="absolute bottom-0 inset-x-0 p-2.5 pointer-events-none">
          <p className="text-white font-bold text-[11px] sm:text-xs truncate drop-shadow-md leading-tight">
            {title}
          </p>
          {overlayText && <div className="mt-0.5">{overlayText}</div>}
        </div>
      </div>

      {subTitle && (
        <div className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition mt-1.5 truncate w-full px-0.5">
          {subTitle}
        </div>
      )}
    </Link>
  );
}
