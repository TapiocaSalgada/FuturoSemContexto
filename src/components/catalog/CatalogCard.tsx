import Link from "next/link";
import { PlayCircle } from "lucide-react";

import type { CatalogItem } from "@/lib/catalog/types";
import FallbackImage from "@/components/catalog/FallbackImage";

export default function CatalogCard({
  item,
  priority = false,
  progress,
  isNew,
}: {
  item: CatalogItem;
  priority?: boolean;
  progress?: number;
  isNew?: boolean;
}) {
  const href = `/anime/${encodeURIComponent(item.slug || item.id)}`;
  const lang = String(item.language || "").toLowerCase();
  const langLabel = lang.includes("dub") ? "DUB" : lang.includes("leg") || lang.includes("sub") ? "SUB" : null;

  return (
    <Link className={priority ? "catalog-card priority" : "catalog-card"} href={href}>
      <div className="poster-frame">
        <FallbackImage src={item.posterUrl || item.coverImage} alt={item.title} fallbackLabel={item.title} />
        {isNew ? <span className="new-episode-badge">Novo</span> : null}
        {langLabel ? <span className="language-badge">{langLabel}</span> : null}
        <span className="play-badge" aria-hidden>
          <PlayCircle size={18} />
        </span>
        {typeof progress === "number" && progress > 0 ? (
          <div className="poster-progress">
            <div className="poster-progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        ) : null}
      </div>
      <div className="catalog-card-copy">
        <strong>{item.title}</strong>
        <span>
          {item.episodeCount > 0 ? `${item.episodeCount} episódios` : "Catálogo"}{item.year ? ` • ${item.year}` : ""}
        </span>
      </div>
    </Link>
  );
}
