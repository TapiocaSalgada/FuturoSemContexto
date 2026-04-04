export type ProviderKey = "kappa" | "sugoi" | "anisbr" | "anfire" | "animefenix" | "playanimes";

export type ProviderSearchItem = {
  id: string;
  title: string;
  image?: string;
  url?: string;
  source: string;
  raw?: any;
};

export type KappaEpisode = {
  id: string;
  number: number;
  title: string;
  thumbnail?: string;
  raw?: any;
};

const DEFAULT_KAPPA_BASE = "https://anime-api-kappa-one.vercel.app/api";
const DEFAULT_LEGACY_BASE = "https://api-anime-free.vercel.app/api";

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  kappa: "Kappa",
  sugoi: "Sugoi API",
  anisbr: "AnimesBrasil",
  anfire: "AnFireAPI",
  animefenix: "AnimeFenix",
  playanimes: "PlayAnimes",
};

const PROVIDER_BASES: Record<Exclude<ProviderKey, "kappa">, string[]> = {
  sugoi: ["https://sugoiapi.vercel.app", "https://sugoi-api.vercel.app"],
  anisbr: [
    "https://theanimesapi.herokuapp.com",
    "https://api-anime-free.vercel.app/api",
  ],
  anfire: ["https://anfireapi.vercel.app", "https://anfire-api.vercel.app"],
  animefenix: [
    "https://animefenix-api.vercel.app",
    "https://anime-fenix-api.vercel.app",
    "https://animefenix-api-scraping-production.up.railway.app",
  ],
  playanimes: [
    "https://playanimes.vercel.app",
    "https://playanimes-api.vercel.app",
    "https://api-playanimes.vercel.app",
    "https://playanimes-sage.vercel.app",
  ],
};

const PROVIDER_ENV_KEYS: Partial<Record<ProviderKey, string>> = {
  kappa: "KAPPA_API_BASE",
  sugoi: "SUGOI_API_BASE",
  anisbr: "ANIMESBR_API_BASE",
  anfire: "ANFIRE_API_BASE",
  animefenix: "ANIMEFENIX_API_BASE",
  playanimes: "PLAYANIMES_API_BASE",
};

function compact<T>(items: (T | null | undefined | false)[]) {
  return items.filter(Boolean) as T[];
}

function normalizeKey(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ensureBase(url: string) {
  return url.replace(/\/+$/, "");
}

function getProviderLabel(provider: ProviderKey) {
  return PROVIDER_LABELS[provider] || provider;
}

function getProviderBases(provider: ProviderKey) {
  if (provider === "kappa") {
    const envBase = process.env.KAPPA_API_BASE?.trim();
    return compact([envBase, DEFAULT_KAPPA_BASE]).map(ensureBase);
  }

  const envKey = PROVIDER_ENV_KEYS[provider];
  const envBase = envKey ? process.env[envKey]?.trim() : "";
  const defaults = PROVIDER_BASES[provider] || [];

  return compact([envBase, ...defaults]).map(ensureBase);
}

function getSearchPaths(provider: ProviderKey, query: string) {
  const q = encodeURIComponent(query);

  const common = [
    `/search?keyword=${q}`,
    `/search?q=${q}`,
    `/api/search?keyword=${q}`,
    `/api/search?q=${q}`,
    `/api/anime/search?q=${q}`,
    `/api/animes/search?q=${q}`,
  ];

  if (provider === "kappa") {
    return [
      `/search?keyword=${q}`,
      `/search?q=${q}`,
    ];
  }

  if (provider === "anisbr") {
    return [`/anime/${q}`, `/api/anime/${q}`, ...common];
  }

  if (provider === "sugoi") {
    return [`/search/${q}`, ...common];
  }

  if (provider === "animefenix") {
    return [
      `/search?q=${q}`,
      `/search?search=${q}`,
      `/api/search?q=${q}`,
      ...common,
    ];
  }

  if (provider === "playanimes") {
    return [
      `/search?query=${q}`,
      `/search?q=${q}`,
      `/api/search?query=${q}`,
      `?search=${q}`,
      `/?search=${q}`,
      ...common,
    ];
  }

  return common;
}

async function fetchJson(url: string, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function extractList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.dados,
    payload?.results,
    payload?.animes,
    payload?.items,
    payload?.episodes,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (payload && typeof payload === "object") {
    const mapEntries = Object.entries(payload).filter(([key, value]) => {
      if (!value || typeof value !== "object") return false;
      if (["success", "sucesso", "status", "message", "error", "info"].includes(key)) return false;
      return true;
    });

    if (mapEntries.length > 0) {
      return mapEntries.map(([id, value]) => ({ id, ...(value as any) }));
    }
  }

  return [];
}

function normalizeItems(payload: any, source: string): ProviderSearchItem[] {
  const list = extractList(payload);

  return list
    .map((item: any, index: number) => {
      const title =
        item?.title ||
        item?.name ||
        item?.nome ||
        item?.ep_name ||
        item?.category_name ||
        item?.anime_title ||
        "";
      const id = String(
        item?.id ||
          item?.animeId ||
          item?.anime_id ||
          item?.category_id ||
          item?.video_id ||
          item?.slug ||
          item?.url ||
          `${source}-${index}`,
      );
      const image =
        item?.img ||
        item?.image ||
        item?.cover ||
        item?.thumb ||
        item?.poster ||
        item?.image_url ||
        item?.category_image ||
        item?.anime_image ||
        "";
      const url = item?.url || item?.link || item?.episode || "";

      return {
        id,
        title,
        image,
        url,
        source,
        raw: item,
      };
    })
    .filter((item) => Boolean(item.title));
}

async function searchAtv2Mirror(query: string, source: string) {
  const payload = await fetchJson(
    `https://atv2.net/meuanimetv-74.php?search=${encodeURIComponent(query)}`,
    12000,
  );
  if (!payload) return [] as ProviderSearchItem[];

  const list = Array.isArray(payload) ? payload : [];
  return dedupe(
    list
      .map((item: any, index: number) => {
        const title = item?.category_name || item?.title || item?.name;
        const id = String(item?.id || item?.category_id || `${source}-atv2-${index}`);
        if (!title) return null;

        return {
          id,
          title,
          image: "",
          url: "",
          source,
          raw: {
            ...item,
            _fallback: "atv2",
          },
        } as ProviderSearchItem;
      })
      .filter(Boolean) as ProviderSearchItem[],
  );
}

async function searchProviderMirror(provider: ProviderKey, query: string) {
  const label = getProviderLabel(provider);

  if (provider === "playanimes") {
    const atv2 = await searchAtv2Mirror(query, label);
    if (atv2.length > 0) return atv2;
  }

  if (provider === "animefenix") {
    const atv2 = await searchAtv2Mirror(query, label);
    if (atv2.length > 0) return atv2;
  }

  if (provider === "anisbr") {
    const atv2 = await searchAtv2Mirror(query, label);
    if (atv2.length > 0) return atv2;
  }

  return [] as ProviderSearchItem[];
}

function dedupe(items: ProviderSearchItem[]) {
  const seen = new Set<string>();
  const output: ProviderSearchItem[] = [];

  for (const item of items) {
    const key = `${normalizeKey(item.title)}|${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

async function searchProviderPrimary(provider: ProviderKey, query: string) {
  const label = getProviderLabel(provider);
  const bases = getProviderBases(provider);
  const paths = getSearchPaths(provider, query);

  for (const base of bases) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      if (!payload) continue;

      const normalized = dedupe(normalizeItems(payload, label));
      if (normalized.length > 0) return normalized;
    }
  }

  return [] as ProviderSearchItem[];
}

async function searchLegacy(query: string) {
  const base = process.env.LEGACY_ANIME_API_BASE?.trim() || DEFAULT_LEGACY_BASE;
  const payload = await fetchJson(`${ensureBase(base)}/search?keyword=${encodeURIComponent(query)}`);
  if (!payload) return [] as ProviderSearchItem[];
  return dedupe(normalizeItems(payload, "Legacy"));
}

export async function searchProviderWithFallback(
  provider: ProviderKey,
  query: string,
  options?: { allowKappaFallback?: boolean },
) {
  const trimmed = query.trim();
  if (!trimmed) return [] as ProviderSearchItem[];

  const allowKappaFallback = options?.allowKappaFallback !== false;

  const label = getProviderLabel(provider);
  const primary = await searchProviderPrimary(provider, trimmed);
  if (primary.length > 0 || provider === "kappa") return primary.slice(0, 60);

  const mirror = await searchProviderMirror(provider, trimmed);
  if (mirror.length > 0) {
    return dedupe(
      mirror.map((item) => ({
        ...item,
        source: label,
        raw: {
          ...item.raw,
          _fallback: item.raw?._fallback || "mirror",
        },
      })),
    ).slice(0, 60);
  }

  if (allowKappaFallback) {
    const kappa = await searchProviderPrimary("kappa", trimmed);
    if (kappa.length > 0) {
      return dedupe(
        kappa.map((item) => ({
          ...item,
          source: label,
          raw: {
            ...item.raw,
            _fallback: "kappa",
          },
        })),
      ).slice(0, 60);
    }
  }

  const legacy = await searchLegacy(trimmed);
  if (legacy.length > 0) {
    return dedupe(
      legacy.map((item) => ({
        ...item,
        source: label,
        raw: {
          ...item.raw,
          _fallback: "legacy",
        },
      })),
    ).slice(0, 60);
  }

  return [] as ProviderSearchItem[];
}

function normalizeEpisodes(payload: any): KappaEpisode[] {
  const list = extractList(payload);

  return list
    .map((item: any, index: number) => {
      const numberRaw = item?.episodio ?? item?.number ?? item?.episode ?? index + 1;
      const number = Number(numberRaw);
      return {
        id: String(item?.id || item?.episode_id || item?.episodio_id || `${index + 1}`),
        number: Number.isFinite(number) ? number : index + 1,
        title: item?.episode_name || item?.title || `Episodio ${numberRaw}`,
        thumbnail: item?.imagem || item?.image || item?.thumb || undefined,
        raw: item,
      };
    })
    .filter((item) => Boolean(item.id));
}

export async function getKappaEpisodes(animeId: string) {
  const bases = getProviderBases("kappa");
  const paths = [
    `/episodes?anime_id=${encodeURIComponent(animeId)}`,
    `/episodes?id=${encodeURIComponent(animeId)}`,
  ];

  for (const base of bases) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      if (!payload) continue;
      const episodes = normalizeEpisodes(payload);
      if (episodes.length > 0) return episodes;
    }
  }

  return [] as KappaEpisode[];
}

export async function getKappaEpisodeVideoUrl(episodeId: string) {
  const bases = getProviderBases("kappa");
  const paths = [
    `/episode-video?episode_id=${encodeURIComponent(episodeId)}`,
    `/episode-video?id=${encodeURIComponent(episodeId)}`,
  ];

  for (const base of bases) {
    for (const path of paths) {
      const payload = await fetchJson(`${base}${path}`);
      const videoUrl = payload?.video_url || payload?.videoUrl;
      if (typeof videoUrl === "string" && videoUrl.startsWith("http")) {
        return videoUrl;
      }
    }
  }

  return null;
}

export async function resolveKappaEpisodeBySlug(slug: string, episodeNumber: number) {
  const normalizedSlug = slug.replace(/[-_]+/g, " ").trim();
  const results = await searchProviderWithFallback("kappa", normalizedSlug);
  if (!results.length) return null;

  const slugKey = normalizeKey(normalizedSlug);
  const selectedAnime =
    results.find((item) => normalizeKey(item.title).includes(slugKey) || slugKey.includes(normalizeKey(item.title))) ||
    results[0];

  if (!selectedAnime?.id) return null;

  const episodes = await getKappaEpisodes(selectedAnime.id);
  if (!episodes.length) return null;

  const targetEpisode =
    episodes.find((item) => item.number === episodeNumber) ||
    episodes[Math.max(0, Math.min(episodes.length - 1, episodeNumber - 1))];

  if (!targetEpisode) return null;

  const videoUrl = await getKappaEpisodeVideoUrl(targetEpisode.id);
  if (!videoUrl) return null;

  return {
    anime: selectedAnime,
    episode: targetEpisode,
    videoUrl,
  };
}
