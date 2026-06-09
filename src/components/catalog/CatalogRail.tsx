import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { CatalogItem } from "@/lib/catalog/types";
import CatalogCard from "@/components/catalog/CatalogCard";

export default function CatalogRail({
  title,
  subtitle,
  items,
  seeAllHref,
}: {
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  seeAllHref?: string;
}) {
  if (!items.length) return null;

  return (
    <section className="rail-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {seeAllHref ? (
          <Link className="see-all-link" href={seeAllHref}>
            Ver tudo <ChevronRight size={16} />
          </Link>
        ) : null}
      </div>
      <div className="rail-scroll">
        {items.map((item) => (
          <CatalogCard key={`${item.source}:${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
