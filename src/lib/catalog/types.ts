export type CatalogSource = "legacy" | "canonical";

export type CatalogKind = "anime" | "serie" | "movie" | "special" | string;

export type CatalogItem = {
  source: CatalogSource;
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  coverImage: string;
  kind: string;
  status: string;
  language: string;
  year: number | null;
  isFeatured: boolean;
  episodeCount: number;
  updatedAt: Date;
};

export type CatalogEpisodeItem = {
  source: CatalogSource;
  id: string;
  slug: string;
  contentId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  synopsis: string;
  thumbnailUrl: string;
  durationLabel: string;
  durationSeconds: number | null;
  status: string;
  watchHref: string | null;
  isPlayable: boolean;
};

export type CatalogSeasonItem = {
  id: string;
  number: number;
  title: string;
  synopsis: string;
  status: string;
};

export type CatalogDetail = CatalogItem & {
  seasons: CatalogSeasonItem[];
  episodes: CatalogEpisodeItem[];
  viewerCount: number;
  matchScore: number;
};

export type CatalogRail = {
  id: string;
  title: string;
  subtitle: string;
  items: CatalogItem[];
};

export type CatalogHomePayload = {
  hero: CatalogItem | null;
  rails: CatalogRail[];
  stats: {
    titles: number;
    episodes: number;
    sources: number;
  };
};
