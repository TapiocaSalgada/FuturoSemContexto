"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Loader2,
  Search,
  Server,
  Sparkles,
  Layers,
} from "lucide-react";

import AppLayout from "@/components/AppLayout";

type SourceKey = "kappa" | "sugoi" | "anisbr" | "anfire" | "anfire_scraper" | "animefenix" | "playanimes";
type SyncProvider = "kappa" | "sugoi" | "anisbr" | "anfire" | "animefenix" | "playanimes";

type SourceItem = {
  id: string;
  title: string;
  image?: string;
  url?: string;
  slug?: string;
  source: string;
  raw?: any;
};

type ImportMeta = {
  provider: SyncProvider;
  externalId?: string;
  query?: string;
  fallback?: string;
  url?: string;
};

type CreateAnimeError = Error & {
  code?: "ANIME_EXISTS";
  existingId?: string;
};

type SourceRules = {
  params: string[];
  endpoint: string;
  hosts: string[];
  cloneNotes?: string;
  envVar?: string;
};

const SOURCE_LABELS: Record<SourceKey, string> = {
  kappa: "Kappa (principal)",
  sugoi: "Sugoi API",
  anisbr: "AnimesBrasil",
  anfire: "AnFireAPI Player",
  anfire_scraper: "AnimeFire Scraper",
  animefenix: "AnimeFenix",
  playanimes: "PlayAnimes",
};

const SOURCE_SYNC_PROVIDER: Record<SourceKey, SyncProvider> = {
  kappa: "kappa",
  sugoi: "sugoi",
  anisbr: "anisbr",
  anfire: "anfire",
  anfire_scraper: "anfire",
  animefenix: "animefenix",
  playanimes: "playanimes",
};

const SOURCE_HELP_TEXT: Record<SourceKey, string> = {
  kappa: "Regra Kappa: busca por keyword.",
  sugoi: "Regra Sugoi: nome/slug (q).",
  anisbr: "Regra AnimesBrasil: name (aceita q também).",
  anfire: "Regra AnFireAPI Player: anime_slug ou anime_link (usa API key no servidor).",
  anfire_scraper: "Regra web-scraper-anime: /anime/search?q=...",
  animefenix: "Regra AnimeFenix: q/search.",
  playanimes: "Regra PlayAnimes: q/query/search.",
};

const SOURCE_RULES: Record<SourceKey, SourceRules> = {
  kappa: {
    params: ["keyword"],
    endpoint: "/api/admin/proxy?endpoint=search&keyword=<texto>",
    hosts: ["https://anime-api-kappa-one.vercel.app/api"],
  },
  sugoi: {
    params: ["q (nome/slug)", "season + episode (na leitura de episodio)"],
    endpoint: "/api/admin/sugoi?q=<texto>",
    hosts: ["https://sugoiapi.vercel.app", "https://sugoi-api.vercel.app"],
    cloneNotes: "Se a API cair, rode sua propria instancia Sugoi e aponte o .env.",
    envVar: "SUGOI_API_BASE",
  },
  anisbr: {
    params: ["name (aceita q/keyword)", "fallback por espelho"],
    endpoint: "/api/admin/anisbr?name=<texto>",
    hosts: ["https://theanimesapi.herokuapp.com", "https://api-anime-free.vercel.app/api"],
    cloneNotes: "Algumas instancias ficam instaveis; em projeto proprio pode exigir clone/deploy da API fonte.",
  },
  anfire: {
    params: ["mode=player", "anime_slug ou anime_link"],
    endpoint: "/api/admin/anfire?mode=player&anime_slug=<slug>",
    hosts: ["ANFIRE_API_BASE (definido no servidor)"],
    cloneNotes: "Modo player depende de API key no backend.",
    envVar: "ANFIRE_API_BASE / ANFIRE_API_KEY",
  },
  anfire_scraper: {
    params: ["mode=scraper", "q"],
    endpoint: "/api/admin/anfire?mode=scraper&q=<texto>",
    hosts: [
      "https://web-scraper-anime.vercel.app",
      "https://web-scraper-anime-production.up.railway.app",
    ],
    cloneNotes: "Para estabilidade total em producao, recomenda-se deploy proprio do scraper.",
    envVar: "ANFIRE_SCRAPER_API_BASE",
  },
  animefenix: {
    params: ["q/keyword", "fallback por espelho quando necessario"],
    endpoint: "/api/admin/animefenix?q=<texto>",
    hosts: [
      "https://animefenix-api.vercel.app",
      "https://anime-fenix-api.vercel.app",
      "https://animefenix-api-scraping-production.up.railway.app",
    ],
  },
  playanimes: {
    params: ["q/query/search", "fallback por espelho quando necessario"],
    endpoint: "/api/admin/playanimes?q=<texto>",
    hosts: [
      "https://playanimes.vercel.app",
      "https://playanimes-api.vercel.app",
      "https://api-playanimes.vercel.app",
    ],
  },
};

const SOURCE_PLACEHOLDER: Record<SourceKey, string> = {
  kappa: "keyword (ex: one piece)",
  sugoi: "nome ou slug (ex: one piece)",
  anisbr: "name (ex: naruto)",
  anfire: "anime_slug ou link completo do animefire",
  anfire_scraper: "q (ex: jujutsu kaisen)",
  animefenix: "q (ex: black clover)",
  playanimes: "query (ex: demon slayer)",
};

const SOURCE_ENDPOINTS: Record<SourceKey, (q: string) => string> = {
  kappa: (q) => `/api/admin/proxy?endpoint=search&keyword=${encodeURIComponent(q)}`,
  sugoi: (q) => `/api/admin/sugoi?q=${encodeURIComponent(q)}`,
  anisbr: (q) => `/api/admin/anisbr?name=${encodeURIComponent(q)}`,
  anfire: (q) => {
    const value = q.trim();
    if (/^https?:\/\//i.test(value)) {
      return `/api/admin/anfire?mode=player&anime_link=${encodeURIComponent(value)}`;
    }
    return `/api/admin/anfire?mode=player&anime_slug=${encodeURIComponent(slugifyQuery(value))}`;
  },
  anfire_scraper: (q) => `/api/admin/anfire?mode=scraper&q=${encodeURIComponent(q)}`,
  animefenix: (q) => `/api/admin/animefenix?q=${encodeURIComponent(q)}`,
  playanimes: (q) => `/api/admin/playanimes?q=${encodeURIComponent(q)}`,
};

function normalizeSugoiToSearch(slug: string, payload: any): SourceItem[] {
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  if (!sources.length) return [];

  const fallback = payload?.provider === "kappa-fallback" ? "kappa" : undefined;
  return [
    {
      id: slug,
      title: slug,
      image: "",
      url: sources[0]?.url,
      source: "Sugoi API",
      raw: { ...payload, slug, _fallback: fallback },
    },
  ];
}

function slugifyQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AnimeImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [queries, setQueries] = useState<Record<SourceKey, string>>({
    kappa: "",
    sugoi: "",
    anisbr: "",
    anfire: "",
    anfire_scraper: "",
    animefenix: "",
    playanimes: "",
  });
  const [loadingBySource, setLoadingBySource] = useState<Record<SourceKey, boolean>>({
    kappa: false,
    sugoi: false,
    anisbr: false,
    anfire: false,
    anfire_scraper: false,
    animefenix: false,
    playanimes: false,
  });
  const [resultsBySource, setResultsBySource] = useState<Record<SourceKey, SourceItem[]>>({
    kappa: [],
    sugoi: [],
    anisbr: [],
    anfire: [],
    anfire_scraper: [],
    animefenix: [],
    playanimes: [],
  });

  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" }>({ text: "", type: "ok" });
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");

  const [sugoiSeason, setSugoiSeason] = useState("1");
  const [sugoiAnimeId, setSugoiAnimeId] = useState("");
  const [sugoiImportingAll, setSugoiImportingAll] = useState(false);
  const [sugoiAllProgress, setSugoiAllProgress] = useState({ current: 0, imported: 0, misses: 0 });
  const [activeSource, setActiveSource] = useState<SourceKey>("kappa");
  const [rulesSource, setRulesSource] = useState<SourceKey | null>(null);
  const [importVisibility, setImportVisibility] = useState<"public" | "admin_only">("public");

  useEffect(() => {
    // @ts-expect-error role
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
    }
  }, [status, session, router]);

  const allResults = useMemo(() => {
    const chunks = Object.values(resultsBySource);
    return chunks.flat();
  }, [resultsBySource]);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 5000);
  };

  const createAnime = async (title: string, image?: string, meta?: ImportMeta) => {
    const markerParts = [
      meta?.provider ? `provider=${meta.provider}` : "",
      meta?.externalId ? `externalId=${String(meta.externalId).replace(/;/g, ",")}` : "",
      meta?.query ? `query=${String(meta.query).replace(/;/g, ",")}` : "",
      meta?.fallback ? `fallback=${String(meta.fallback).replace(/;/g, ",")}` : "",
      meta?.url ? `url=${String(meta.url).replace(/;/g, ",")}` : "",
    ].filter(Boolean);
    const marker = markerParts.length ? `\n[import-meta ${markerParts.join("; ")}]` : "";

    const res = await fetch("/api/admin/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        coverImage: image || "",
        bannerImage: image || "",
        status: "ongoing",
        visibility: importVisibility,
        description: `Importado via fonte externa: ${title}${marker}`,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const error = new Error(
        payload?.error || payload?.message || "Erro ao criar anime.",
      ) as CreateAnimeError;

      if (res.status === 409 && payload?.existingId) {
        error.code = "ANIME_EXISTS";
        error.existingId = payload.existingId;
      }

      throw error;
    }

    return res.json();
  };

  const importAnimeFromKappa = async (item: SourceItem) => {
    if (importingId) return;
    setImportingId(item.id);
    setImportStatus("Criando anime...");

    try {
      let animeId = "";
      try {
        const created = await createAnime(item.title, item.image, {
          provider: "kappa",
          externalId: item.id,
          query: item.title,
          fallback: item.raw?._fallback,
          url: item.url,
        });
        animeId = created.id;
      } catch (error: any) {
        const typedError = error as CreateAnimeError;
        if (typedError.code === "ANIME_EXISTS" && typedError.existingId) {
          animeId = typedError.existingId;
          setImportStatus("Anime ja existe. Sincronizando episodios...");
        } else {
          throw error;
        }
      }

      setImportStatus("Buscando episódios na Kappa...");
      const epsRes = await fetch(`/api/admin/proxy?endpoint=episodes&id=${encodeURIComponent(item.id)}`);
      const epsData = await epsRes.json();
      const episodes = Array.isArray(epsData) ? epsData : [];

      if (!episodes.length) {
        showMsg("Anime criado sem episódios (Kappa não retornou lista).", "ok");
        return;
      }

      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        setImportStatus(`Importando episódio ${i + 1}/${episodes.length}...`);
        try {
          const videoRes = await fetch(`/api/admin/proxy?endpoint=episode-video&id=${encodeURIComponent(ep.id)}`);
          const video = await videoRes.json();
          if (!video?.videoUrl) continue;

          await fetch("/api/admin/episode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              animeId,
              number: Number(ep.number) || i + 1,
              season: 1,
              title: ep.title || `Episódio ${ep.number || i + 1}`,
              videoUrl: video.videoUrl,
              sourceLabel: "Kappa API",
            }),
          });
        } catch {
          // skip broken episode
        }
      }

      showMsg(`Importação concluída: ${item.title}`, "ok");
    } catch (error: any) {
      showMsg(error?.message || "Erro na importação Kappa.", "err");
    } finally {
      setImportingId(null);
      setImportStatus("");
    }
  };

  const importBasicAnime = async (item: SourceItem, source: SourceKey) => {
    if (importingId) return;
    setImportingId(item.id);
    setImportStatus(`Criando anime (${item.source})...`);
    try {
      const syncProvider = SOURCE_SYNC_PROVIDER[source];
      const sourceExternalId = String(
        syncProvider === "sugoi"
          ? item.slug || item.raw?.slug || item.raw?.id || item.id || ""
          : syncProvider === "anfire"
            ? item.slug || item.raw?.slug || item.raw?.anime_slug || slugifyQuery(item.title || "") || ""
          : item.raw?.slug || item.raw?.id || item.id || "",
      );

      let animeId = "";
      try {
        const created = await createAnime(item.title, item.image, {
          provider: syncProvider,
          externalId: sourceExternalId,
          query: item.title,
          fallback: item.raw?._fallback,
          url: item.url,
        });
        animeId = created.id;
      } catch (error: any) {
        const typedError = error as CreateAnimeError;
        if (typedError.code === "ANIME_EXISTS" && typedError.existingId) {
          animeId = typedError.existingId;
          setImportStatus(`Anime ja existe. Sincronizando via ${SOURCE_LABELS[source]}...`);
        } else {
          throw error;
        }
      }

      setImportStatus(`Sincronizando episodios via ${SOURCE_LABELS[source]}...`);
      const syncRes = await fetch("/api/admin/anime/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId,
          provider: syncProvider,
          query: item.title,
          externalId: sourceExternalId,
          limit: 80,
        }),
      });
      const syncData = await syncRes.json().catch(() => ({}));

      if (syncRes.ok && Number(syncData?.imported || 0) > 0) {
        showMsg(`Anime + ${syncData.imported} episodio(s) importado(s) em ${item.source}: ${item.title}`, "ok");
      } else {
        showMsg(`Anime importado (${item.source}): ${item.title}`, "ok");
      }
    } catch (error: any) {
      showMsg(error?.message || "Erro na importação.", "err");
    } finally {
      setImportingId(null);
      setImportStatus("");
    }
  };

  const searchSource = async (source: SourceKey) => {
    const q = queries[source]?.trim();
    if (!q) return;

    const requestQuery = q;

    setLoadingBySource((prev) => ({ ...prev, [source]: true }));
    setResultsBySource((prev) => ({ ...prev, [source]: [] }));

    try {
      const endpoint = SOURCE_ENDPOINTS[source](requestQuery);
      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || `Falha na fonte ${SOURCE_LABELS[source]}`);

      let normalized: SourceItem[] = [];
      if (source === "sugoi") {
        const list = Array.isArray(data)
          ? data
          : normalizeSugoiToSearch(slugifyQuery(requestQuery), data);
        normalized = list.map((item: any, idx: number) => ({
          id: String(item.id || item.raw?.slug || `${source}-${idx}`),
          title: item.title || item.name || item.nome || "Sem título",
          image: item.image || item.cover || "",
          url: item.url || item.link || "",
          slug: String(item.slug || item.raw?.slug || slugifyQuery(item.title || item.name || "") || ""),
          source: item.source || SOURCE_LABELS[source],
          raw: {
            ...(item.raw || item),
            ...(item.slug || item.raw?.slug
              ? { slug: String(item.slug || item.raw?.slug) }
              : {}),
          },
        }));
      } else {
        const list = Array.isArray(data) ? data : [];
        normalized = list.map((item: any, idx: number) => ({
          id: String(item.id || `${source}-${idx}`),
          title: item.title || item.name || item.nome || "Sem título",
          image: item.image || item.cover || "",
          url: item.url || item.link || "",
          slug: String(item.slug || item.raw?.slug || item.raw?.anime_slug || ""),
          source: item.source || SOURCE_LABELS[source],
          raw: item.raw || item,
        }));
      }

      setResultsBySource((prev) => ({ ...prev, [source]: normalized }));
      if (!normalized.length) {
        showMsg(`Sem resultados em ${SOURCE_LABELS[source]}.`, "err");
      }
    } catch (error: any) {
      showMsg(error?.message || `Erro em ${SOURCE_LABELS[source]}.`, "err");
    } finally {
      setLoadingBySource((prev) => ({ ...prev, [source]: false }));
    }
  };

  const importAllFromSource = async (source: SourceKey) => {
    const list = resultsBySource[source] || [];
    if (!list.length) return;

    for (const item of list) {
      if (source === "kappa") await importAnimeFromKappa(item);
      else await importBasicAnime(item, source);
    }
  };

  const importAllSugoiEpisodes = async () => {
    const queryText = queries.sugoi.trim();
    if (!queryText) {
      showMsg("Informe o nome ou slug da Sugoi para importar episódios.", "err");
      return;
    }

    const firstSugoiResult = resultsBySource.sugoi[0];
    const slug = String(
      firstSugoiResult?.slug ||
      firstSugoiResult?.raw?.slug ||
      slugifyQuery(queryText),
    ).trim();

    setSugoiImportingAll(true);
    setSugoiAllProgress({ current: 0, imported: 0, misses: 0 });

    try {
      let animeId = sugoiAnimeId.trim();
      const season = Number(sugoiSeason) > 0 ? Number(sugoiSeason) : 1;
      if (!animeId) {
        try {
          const created = await createAnime(`Sugoi: ${firstSugoiResult?.title || queryText}`, firstSugoiResult?.image || "", {
            provider: "sugoi",
            externalId: slug || undefined,
            query: queryText,
          });
          animeId = created.id;
        } catch (error: any) {
          const typedError = error as CreateAnimeError;
          if (typedError.code === "ANIME_EXISTS" && typedError.existingId) {
            animeId = typedError.existingId;
          } else {
            throw error;
          }
        }
        setSugoiAnimeId(animeId);
      }

      const syncRes = await fetch("/api/admin/anime/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId,
          provider: "sugoi",
          query: queryText,
          externalId: slug || undefined,
          season,
          limit: 200,
        }),
      });
      const syncData = await syncRes.json().catch(() => ({}));

      if (!syncRes.ok) {
        throw new Error(syncData?.error || "Falha ao sincronizar episódios da Sugoi.");
      }

      const imported = Number(syncData?.imported || 0);
      const failed = Number(syncData?.failed || 0);
      const scanned = Number(syncData?.scanned || imported + failed);
      setSugoiAllProgress({ current: scanned, imported, misses: failed });
      showMsg(`Sugoi sincronizado: ${imported} episódio(s) novo(s), ${failed} falha(s).`, "ok");
    } catch (error: any) {
      showMsg(error?.message || "Falha ao importar todos episódios via Sugoi.", "err");
    } finally {
      setSugoiImportingAll(false);
    }
  };

  // @ts-expect-error role
  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "admin")) return null;

  const selectedRules = rulesSource ? SOURCE_RULES[rulesSource] : null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-zinc-500 hover:text-red-400 flex items-center gap-1 text-sm mb-2 transition">
              <ChevronLeft size={16} /> Voltar ao painel
            </Link>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Download className="text-red-400" /> Importador <span className="text-red-400">multi-API</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Cada API tem seu espaço próprio para buscar e importar.</p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs text-zinc-500">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-black/35 px-3 py-2">
              <Sparkles size={14} className="text-red-300" />
              Kappa principal • Sugoi/AnimesBrasil fallback
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-black/35 px-3 py-2">
              <span className="text-zinc-400 font-black">Novos animes:</span>
              <select
                value={importVisibility}
                onChange={(event) => setImportVisibility(event.target.value as "public" | "admin_only")}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-white font-bold"
              >
                <option value="public">Publico</option>
                <option value="admin_only">So admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="md:hidden rounded-2xl border border-white/12 bg-black/35 p-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-400 font-bold">Visibilidade dos novos animes</p>
          <select
            value={importVisibility}
            onChange={(event) => setImportVisibility(event.target.value as "public" | "admin_only")}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-bold"
          >
            <option value="public">Publico</option>
            <option value="admin_only">So admin</option>
          </select>
        </div>

        {msg.text && (
          <div className={`p-4 rounded-2xl text-sm font-bold border ${msg.type === "ok" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {msg.text}
          </div>
        )}

        {importStatus && (
          <div className="p-4 rounded-2xl text-sm font-bold border bg-red-500/10 text-red-200 border-red-500/20 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> {importStatus}
          </div>
        )}

        <section className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-white font-black flex items-center gap-2"><Layers size={18} className="text-red-300" /> Fontes de busca/importação</h2>
          <div className="flex md:hidden gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((source) => (
              <button
                key={`tab-${source}`}
                type="button"
                onClick={() => setActiveSource(source)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  activeSource === source
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {SOURCE_LABELS[source]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((source) => (
              <div
                key={source}
                className={`p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-3 ${activeSource === source ? "block" : "hidden md:block"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white flex items-center gap-2"><Server size={14} className="text-red-300" /> {SOURCE_LABELS[source]}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-1 rounded-lg border border-white/12 bg-black/35 text-zinc-300 font-black">
                      {resultsBySource[source].length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRulesSource(source)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
                    >
                      Regras
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResultsBySource((prev) => ({ ...prev, [source]: [] }));
                      }}
                      disabled={loadingBySource[source] || !!importingId}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-bold"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      disabled={loadingBySource[source] || !resultsBySource[source]?.length || !!importingId}
                      onClick={() => importAllFromSource(source)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-bold"
                    >
                      Importar todos
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                    <input
                      value={queries[source]}
                      onChange={(e) => setQueries((prev) => ({ ...prev, [source]: e.target.value }))}
                      placeholder={SOURCE_PLACEHOLDER[source]}
                      className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  <button
                    type="button"
                    onClick={() => searchSource(source)}
                    disabled={loadingBySource[source] || !!importingId}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold"
                    >
                      {loadingBySource[source] ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    </button>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{SOURCE_HELP_TEXT[source]}</p>

                {source === "sugoi" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={sugoiSeason}
                      onChange={(e) => setSugoiSeason(e.target.value)}
                      placeholder="Temporada"
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={sugoiAnimeId}
                      onChange={(e) => setSugoiAnimeId(e.target.value)}
                      placeholder="AnimeId local (opcional)"
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={sugoiImportingAll || !queries.sugoi.trim()}
                      onClick={importAllSugoiEpisodes}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-sm"
                    >
                      {sugoiImportingAll ? "Importando..." : "Importar todos ep"}
                    </button>
                  </div>
                )}

                {source === "sugoi" && sugoiImportingAll && (
                  <p className="text-xs text-zinc-400">Escaneados: {sugoiAllProgress.current} • importados: {sugoiAllProgress.imported} • falhas: {sugoiAllProgress.misses}</p>
                )}

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {resultsBySource[source].map((item) => (
                    <div key={`${source}-${item.id}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-12 h-14 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-14 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-400 uppercase">
                          {item.title.replace(/\s+/g, "").slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-bold leading-tight break-words">{item.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.source}</p>
                          {item.raw?._fallback && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                              fallback {String(item.raw._fallback)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.url && item.url.startsWith("http") && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-[11px] font-black"
                            title="Abrir site original"
                          >
                            Site
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!!importingId}
                          onClick={() => (source === "kappa" ? importAnimeFromKappa(item) : importBasicAnime(item, source))}
                          className="px-2.5 py-1.5 rounded-lg bg-white text-black hover:bg-red-500 hover:text-white text-xs font-black"
                        >
                          Importar
                        </button>
                      </div>
                    </div>
                  ))}
                  {!resultsBySource[source].length && (
                    <p className="text-xs text-zinc-600">Sem resultados nesta fonte.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {rulesSource && selectedRules && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setRulesSource(null)} />
            <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-700 bg-[#121212] p-5 md:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Guia da fonte</p>
                  <h3 className="text-lg md:text-xl font-black text-white mt-1">{SOURCE_LABELS[rulesSource]}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRulesSource(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-black"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-2 text-xs text-zinc-300">
                <p className="font-black text-zinc-100">Parametros esperados</p>
                <ul className="space-y-1.5">
                  {selectedRules.params.map((param) => (
                    <li key={param} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">{param}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 text-xs text-zinc-300">
                <p className="font-black text-zinc-100">Endpoint interno</p>
                <code className="block rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-cyan-300 break-all">{selectedRules.endpoint}</code>
              </div>

              <div className="space-y-2 text-xs text-zinc-300">
                <p className="font-black text-zinc-100">Hosts/instancias consultadas</p>
                <ul className="space-y-1.5">
                  {selectedRules.hosts.map((host) => (
                    <li key={host} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 break-all">{host}</li>
                  ))}
                </ul>
              </div>

              {(selectedRules.cloneNotes || selectedRules.envVar) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs font-black text-amber-300">Quando precisa clonar/deploy proprio</p>
                  {selectedRules.cloneNotes && <p className="text-xs text-amber-100/90">{selectedRules.cloneNotes}</p>}
                  {selectedRules.envVar && <p className="text-[11px] text-amber-200">Env recomendado: <code>{selectedRules.envVar}</code></p>}
                  <code className="block rounded-lg bg-black/35 border border-amber-400/20 px-3 py-2 text-[11px] text-amber-100">git clone &lt;repo-da-api&gt; && npm install && npm run dev</code>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 space-y-2">
          <h3 className="text-white font-black">Resumo geral</h3>
          <p className="text-zinc-400 text-sm">Resultados carregados: <span className="text-red-300 font-bold">{allResults.length}</span></p>
          <p className="text-zinc-500 text-xs">Importação agora tenta sincronizar episódios em todas as fontes. Se aparecer badge de fallback, a busca veio de rota espelho para manter funcionamento.</p>
        </section>
      </div>
    </AppLayout>
  );
}
