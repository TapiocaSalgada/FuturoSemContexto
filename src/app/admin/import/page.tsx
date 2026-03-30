"use client";

import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Download, CheckCircle2, ChevronLeft, Film, PlayCircle, ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface KappaAnime {
  id: string;
  title: string;
  url: string;
  image: string;
}

interface KappaEpisode {
  id: string;
  number: string;
  title: string;
}

export default function AnimeImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KappaAnime[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: "" });
  const [msg, setMsg] = useState({ text: "", type: "ok" });
  const [slug, setSlug] = useState("");
  const [sugoiSeason, setSugoiSeason] = useState("1");
  const [sugoiEpisode, setSugoiEpisode] = useState("1");
  const [sugoiLoading, setSugoiLoading] = useState(false);
  const [sugoiSources, setSugoiSources] = useState<{ provider: string; url: string; isEmbed: boolean; hasAds: boolean; searchedEndpoint?: string }[]>([]);
  const [anisBrLoading, setAnisBrLoading] = useState(false);
  const [combinedResults, setCombinedResults] = useState<(KappaAnime & { source: string })[]>([]);

  useEffect(() => {
    // @ts-expect-error role
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
    }
  }, [status, session, router]);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 5000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setCombinedResults([]);
    try {
      setAnisBrLoading(true);
      const kappaPromise = fetch(`/api/admin/proxy?endpoint=search&keyword=${encodeURIComponent(query)}`).then(r => r.json());
      const anisPromise = fetch(`/api/admin/anisbr?name=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []);

      const [kappaData, anisData] = await Promise.all([kappaPromise, anisPromise]);

      if (kappaData?.error) throw new Error(kappaData.error);

      const kappaList = Array.isArray(kappaData) ? kappaData : [];
      const kappaClean = kappaList.filter((item) => item?.title && item?.id).map((i: any) => ({ ...i, source: "Kappa" }));

      const anisList = Array.isArray(anisData) ? anisData : [];
      const anisClean = anisList.filter((item) => item?.title && item?.id).map((i: any) => ({ ...i, source: "AnimesBrasil" }));

      setResults(kappaClean as any);
      const combined = [...kappaClean, ...anisClean];
      setCombinedResults(combined);

      if (combined.length === 0) showMsg("Nenhum resultado válido nas fontes externas.", "err");
    } catch (error: any) {
      showMsg(error.message || "Erro ao buscar na API externa.", "err");
    } finally {
      setLoading(false);
      setAnisBrLoading(false);
    }
  };

  const fetchSugoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !sugoiEpisode.trim()) return;
    setSugoiLoading(true);
    setSugoiSources([]);
    try {
      const res = await fetch(`/api/admin/sugoi?slug=${encodeURIComponent(slug)}&season=${encodeURIComponent(sugoiSeason)}&episode=${encodeURIComponent(sugoiEpisode)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Falha na SugoiAPI");
      const sources = Array.isArray(data.sources) ? data.sources : [];
      setSugoiSources(sources);
      showMsg(`Sugoi: ${sources.length} fontes encontradas.`, "ok");
    } catch (err: any) {
      setSugoiSources([]);
      showMsg(err.message || "Erro ao consultar SugoiAPI", "err");
    } finally {
      setSugoiLoading(false);
    }
  };

  const importAnime = async (item: KappaAnime) => {
    if (importingId) return;
    setImportingId(item.id);
    setImportProgress({ current: 0, total: 0, status: "Criando anime no banco..." });

    try {
      // 1. Create Anime
      const animeRes = await fetch("/api/admin/anime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          coverImage: item.image,
          status: "ongoing",
          visibility: "admin_only",
          description: `Importado via API: ${item.title}`
        })
      });

      if (!animeRes.ok) {
        const errText = await animeRes.text();
        throw new Error(errText || "Falha ao criar anime.");
      }

      const newAnime = await animeRes.json();
      const localAnimeId = newAnime.id;

      // 2. Fetch Episodes from Proxy
      setImportProgress(p => ({ ...p, status: "Buscando lista de episódios..." }));
      const epsRes = await fetch(`/api/admin/proxy?endpoint=episodes&id=${item.id}`);
      const epsData = await epsRes.json();
      console.log("Kappa API Episodes Response:", epsData);
      
      if (!epsData || !Array.isArray(epsData) || epsData.length === 0) {
        showMsg("Anime criado, mas não foram encontrados episódios ou erro na API.", "ok");
        setImportingId(null);
        return;
      }

      setImportProgress({ current: 0, total: epsData.length, status: `Importando ${epsData.length} episódios...` });

      // 3. Import each episode
      for (let i = 0; i < epsData.length; i++) {
        const kappaEp = epsData[i];
        setImportProgress(p => ({ ...p, current: i + 1, status: `Processando Ep ${kappaEp.number}...` }));

        try {
          // Get video URL from Proxy
          const videoRes = await fetch(`/api/admin/proxy?endpoint=episode-video&id=${kappaEp.id}`);
          if (!videoRes.ok) throw new Error("Video API unreachable");
          const videoData = await videoRes.json();

          if (videoData && videoData.videoUrl) {
            // Save to local DB
            const saveRes = await fetch("/api/admin/episode", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                animeId: localAnimeId,
                number: parseInt(kappaEp.number) || (i + 1),
                season: 1,
                title: kappaEp.title || `Episódio ${kappaEp.number}`,
                videoUrl: videoData.videoUrl,
                sourceLabel: "Kappa API"
              })
            });

            if (!saveRes.ok && saveRes.status !== 409) {
               console.warn(`Erro ao salvar ep ${kappaEp.number}`);
            }
          }
        } catch (e) {
          console.error(`Erro no Ep ${kappaEp.number}`, e);
        }
      }

      showMsg(`Sucesso! ${item.title} importado com todos os episódios.`);
    } catch (error: any) {
      showMsg(error.message || "Erro durante a importação.", "err");
    } finally {
      setImportingId(null);
      setImportProgress({ current: 0, total: 0, status: "" });
    }
  };

  // @ts-expect-error role
  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "admin")) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 pb-24 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-fadeInUp">
          <div>
            <Link href="/admin" className="text-zinc-500 hover:text-pink-500 flex items-center gap-1 text-sm mb-2 transition">
              <ChevronLeft size={16} /> Voltar ao Painel
            </Link>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Download className="text-pink-500" /> Importador <span className="text-pink-500">API</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Busque e importe animes completos da API externa Kappa One.</p>
          </div>
        </div>

        {msg.text && (
          <div className={`p-4 rounded-2xl text-sm font-bold border animate-fadeInUp shadow-lg ${msg.type === "ok" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {msg.text}
          </div>
        )}

        {/* Search Section */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 lg:p-8 animate-fadeInUp">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Solo Leveling, One Piece..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-pink-500 rounded-2xl py-4 pl-12 pr-4 text-white transition shadow-inner"
              />
            </div>
            <button
              disabled={loading || !!importingId}
              type="submit"
              className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-black px-8 rounded-2xl transition shadow-[0_0_20px_rgba(255,0,127,0.3)] flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
              <span className="hidden md:block">BUSCAR</span>
            </button>
          </form>
        </section>

        {/* Importing Progress */}
        {importingId && (
          <div className="bg-pink-600/10 border border-pink-500/20 rounded-3xl p-6 animate-pulse shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-pink-500" size={24} />
                <h3 className="font-black text-white uppercase tracking-wider">{importProgress.status}</h3>
              </div>
              <span className="text-pink-500 font-black">
                {importProgress.total > 0 ? `${importProgress.current} / ${importProgress.total}` : "..."}
              </span>
            </div>
            {importProgress.total > 0 && (
              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden border border-white/5">
                <div 
                  className="bg-pink-500 h-full transition-all duration-500 shadow-[0_0_15px_rgba(255,0,127,0.5)]" 
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Results Grid combinado (Kappa + AnimesBrasil) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {combinedResults.map((item) => (
            <div key={`${item.source}-${item.id}`} className="group relative bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden hover:border-pink-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,127,0.15)] hover:-translate-y-1">
              <div className="aspect-[3/4] relative">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                
                {/* Hover Actions */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition duration-300">
                  <button
                    disabled={!!importingId}
                    onClick={() => importAnime(item)}
                    className="bg-white text-black font-black px-6 py-2.5 rounded-xl hover:bg-pink-500 hover:text-white transition flex items-center gap-2 shadow-2xl active:scale-95 disabled:opacity-50"
                  >
                    <Download size={16} /> IMPORTAR
                  </button>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/70 hover:text-white transition flex items-center gap-1 font-bold bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-md">
                      VER ORIGINAL <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-white font-bold text-sm line-clamp-2 leading-snug group-hover:text-pink-400 transition">{item.title}</h3>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">API ID: {item.id}</p>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <div className="py-20 text-center space-y-4">
             <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                <Film size={32} className="text-zinc-700" />
             </div>
             <p className="text-zinc-500 font-medium">Digite o nome de um anime para buscar na API.</p>
          </div>
        )}

        {/* SugoiAPI (Slug) */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 lg:p-8 space-y-4 animate-fadeInUp">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-black text-white flex items-center gap-2">SugoiAPI (slug / temporada / episódio)</h2>
            <p className="text-xs text-zinc-500">Use quando souber o slug exato (ex: naruto, one-piece)</p>
          </div>
          <form onSubmit={fetchSugoi} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (ex: naruto)" className="bg-zinc-950 border border-zinc-800 focus:border-pink-500 rounded-2xl px-4 py-3 text-white" />
            <input value={sugoiSeason} onChange={(e) => setSugoiSeason(e.target.value)} placeholder="Temporada (default 1)" className="bg-zinc-950 border border-zinc-800 focus:border-pink-500 rounded-2xl px-4 py-3 text-white" />
            <input value={sugoiEpisode} onChange={(e) => setSugoiEpisode(e.target.value)} placeholder="Episódio" className="bg-zinc-950 border border-zinc-800 focus:border-pink-500 rounded-2xl px-4 py-3 text-white" />
            <button disabled={sugoiLoading} type="submit" className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-black px-6 rounded-2xl transition shadow-[0_0_20px_rgba(255,0,127,0.3)] flex items-center justify-center gap-2">
              {sugoiLoading ? <Loader2 className="animate-spin" size={18} /> : "Consultar"}
            </button>
          </form>
          {sugoiSources.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sugoiSources.map((src, idx) => (
                <div key={`${src.provider}-${idx}`} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white space-y-1">
                  <p className="font-bold text-pink-400">{src.provider}</p>
                  <p className="text-xs text-zinc-400">{src.isEmbed ? "Embed" : "MP4"} • {src.hasAds ? "Com anúncios" : "Sem anúncios"}</p>
                  {src.searchedEndpoint && <p className="text-[11px] text-zinc-500 break-all">{src.searchedEndpoint}</p>}
                  <div className="mt-2">
                    <a href={src.url} target="_blank" rel="noreferrer" className="text-xs break-all underline text-white">{src.url}</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
