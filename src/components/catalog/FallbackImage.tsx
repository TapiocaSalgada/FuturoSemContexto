"use client";

import { useState } from "react";

export default function FallbackImage({
  src,
  alt,
  className,
  fallbackLabel,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const value = String(src || "").trim();

  if (!value || failed) {
    return (
      <div className={className ? `${className} image-fallback` : "image-fallback"}>
        <span>{fallbackLabel.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={value} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
