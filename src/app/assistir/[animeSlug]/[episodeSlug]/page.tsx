import { notFound } from "next/navigation";

import WatchExperience from "@/components/player/WatchExperience";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function AssistirPage({ params }: { params: { animeSlug: string; episodeSlug: string } }) {
  const animeSlug = decodeURIComponent(params.animeSlug || "");
  const episodeSlug = decodeURIComponent(params.episodeSlug || "");
  if (!animeSlug || !episodeSlug) notFound();

  const content = await prisma.content.findFirst({
    where: { OR: [{ slug: animeSlug }, { id: animeSlug }] },
    include: { episodes: { where: { status: { in: ["public", "published"] } }, orderBy: [{ episodeNumber: "asc" }] } },
  }).catch(() => null);

  if (content && ["public", "published"].includes(String(content.status || "").toLowerCase())) {
    const target = content.episodes.find((episode) => episode.id === episodeSlug || episode.slug === episodeSlug || normalize(episode.title) === normalize(episodeSlug) || `episodio-${episode.episodeNumber}` === normalize(episodeSlug));
    if (target) return <WatchExperience id={target.id} />;
  }

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ slug: animeSlug }, { id: animeSlug }], visibility: "public" },
    include: { episodes: { where: { status: "published" }, orderBy: [{ season: "asc" }, { number: "asc" }] } },
  });

  if (!anime) notFound();
  const target = anime.episodes.find((episode) => episode.id === episodeSlug || normalize(episode.title) === normalize(episodeSlug) || `episodio-${episode.number}` === normalize(episodeSlug));
  if (!target) notFound();

  return <WatchExperience id={target.id} />;
}
