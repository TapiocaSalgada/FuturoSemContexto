import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function WatchCompatPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const canonical = await prisma.catalogEpisode.findUnique({
    where: { id },
    include: { content: { select: { slug: true, status: true } } },
  }).catch(() => null);
  if (canonical && ["public", "published"].includes(String(canonical.content.status || "").toLowerCase())) {
    redirect(`/assistir/${encodeURIComponent(canonical.content.slug)}/${encodeURIComponent(canonical.slug || slugify(canonical.title) || canonical.id)}`);
  }

  const legacy = await prisma.episode.findUnique({
    where: { id },
    include: { anime: { select: { id: true, slug: true, visibility: true } } },
  });
  if (legacy && legacy.status === "published" && legacy.anime.visibility === "public") {
    redirect(`/assistir/${encodeURIComponent(legacy.anime.slug || legacy.anime.id)}/${encodeURIComponent(`episodio-${legacy.number}`)}`);
  }

  notFound();
}
