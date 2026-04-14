"use client";

import { useEffect, useMemo, useState } from "react";

import { buildImageCandidates } from "@/lib/image-quality";

type CinematicBannerImageProps = {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  shadeClassName?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
};

export default function CinematicBannerImage({
  src,
  fallbackSrc,
  alt,
  className = "",
  imageClassName = "",
  shadeClassName = "bg-black/28",
  loading = "lazy",
  fetchPriority = "auto",
}: CinematicBannerImageProps) {
  const imageCandidates = useMemo(() => buildImageCandidates(src, fallbackSrc), [src, fallbackSrc]);
  const [imageIndex, setImageIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    setImageIndex(0);
    setIsImageLoading(true);
  }, [src, fallbackSrc]);

  const currentImage = imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)] || "/logo.png";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {isImageLoading ? <div className="absolute inset-0 z-[1] kdr-skeleton" /> : null}

      <img
        src={currentImage}
        alt=""
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full scale-[1.14] object-cover blur-2xl saturate-[1.25] transition-opacity duration-300 ${
          isImageLoading ? "opacity-0" : "opacity-55"
        }`}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
      />

      <img
        src={currentImage}
        alt=""
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover transition-opacity duration-300 ${
          isImageLoading ? "opacity-0" : "opacity-40"
        }`}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
      />

      <div className={`pointer-events-none absolute inset-0 ${shadeClassName}`} />

      <img
        src={currentImage}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-300 ${
          isImageLoading ? "opacity-0" : "opacity-100"
        } ${imageClassName}`}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={() => setIsImageLoading(false)}
        onError={() => {
          const nextIndex = imageIndex + 1;
          if (nextIndex < imageCandidates.length) {
            setImageIndex(nextIndex);
            return;
          }
          setIsImageLoading(false);
        }}
      />
    </div>
  );
}
