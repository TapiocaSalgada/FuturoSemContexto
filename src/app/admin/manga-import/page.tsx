"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, Download, Loader2, Search } from "lucide-react";

import AppLayout from "@/components/AppLayout";

type SearchItem = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  sourceUrl: string;
  chapterCount?: number;
};

export default function MangaImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [translatedOnly, setTranslatedOnly] = useState(false);
  const [withChapterCount, setWithChapterCount] = useState(true);
  const [malEnrich, setMalEnrich] = useState(true);
  const [visibility, setVisibility] = useState<"admin_only" | "public">("public");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" }>({ text: "", type: "ok" });

  useEffect(() => {
    // @ts-expect-error nextauth role
    if (status === "unauthenticated" || (status === "authenticated" && session?.user?.role !== "admin")) {
      router.push("/");
    }
  }, [status, session, router]);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 4500);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        withChapters: withChapterCount ? "1" : "0",
        translatedOnly: translatedOnly ? "1" : "0",
      });
      const res = await fetch(`/api/admin/mangadex/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        showMsg(data?.error || "Falha na busca", "err");
        return;
      }
      setResults(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        showMsg("Nenhum manga encontrado.", "err");
      }
    } catch {
      showMsg("Falha na busca MangaDex.", "err");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item: SearchItem) => {
    setImportingId(item.id);
    try {
      const res = await fetch("/api/admin/manga/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mangaDexId: item.id,
            title: item.title,
            translatedOnly,
            malEnrich,
            visibility,
            replaceChapters: true,
          }),
        });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data?.error || "Falha ao importar manga.", "err");
        return;
      }

      showMsg(
        `${item.title}: ${Number(data?.importedChapters || 0)} capitulo(s) importado(s) em ${Number(data?.pagesFetched || 1)} pagina(s)$${
          data?.malEnriched ? " + metadados MAL" : malEnrich ? " (sem match MAL)" : ""
        }.`.replace("$", ""),
        "ok",
      );
    } catch {
      showMsg("Erro ao importar manga.", "err");
    } finally {
      setImportingId(null);
    }
  };

  if (status === "loading") return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-2">
              <ChevronLeft size={15} /> Voltar ao painel
            </Link>
            <h1 className="text-3xl font-black text-white">Importar Mangas (MangaDex)</h1>
            <p className="text-zinc-400 text-sm mt-1">Busca no MangaDex e enriquece metadados via MAL/Jikan.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="Ex: Solo Leveling"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-60"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={translatedOnly}
                onChange={(e) => setTranslatedOnly(e.target.checked)}
              />
              Limitar idiomas (pt/en)
            </label>
            <label className="inline-flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={withChapterCount}
                onChange={(e) => setWithChapterCount(e.target.checked)}
              />
              Mostrar estimativa de capitulos
            </label>
            <label className="inline-flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={malEnrich}
                onChange={(e) => setMalEnrich(e.target.checked)}
              />
              Enriquecer metadados MAL (manga)
            </label>
            <label className="inline-flex items-center gap-2 text-zinc-300">
              Visibilidade inicial:
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "admin_only" | "public")}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1"
              >
                <option value="public">Publico</option>
                <option value="admin_only">Somente admin</option>
              </select>
            </label>
          </div>
        </section>

        {msg.text && (
          <div className={`text-sm rounded-xl px-4 py-2 border ${msg.type === "ok" ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            {msg.text}
          </div>
        )}

        <section className="space-y-3">
          {results.map((item) => (
            <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 md:p-4 flex gap-3">
              <div className="relative w-20 h-28 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                <img
                  src={
                    item.coverImage ||
                    "/logo.png"
                  }
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(event) => {
                    if (event.currentTarget.src.endsWith("/logo.png")) return;
                    event.currentTarget.src = "/logo.png";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="font-bold text-white text-sm md:text-base line-clamp-2">{item.title}</h3>
                <p className="text-zinc-400 text-xs line-clamp-3">{item.description || "Sem descricao"}</p>
                <div className="text-[11px] text-zinc-500 flex flex-wrap gap-3">
                  <span>ID: {item.id}</span>
                  {typeof item.chapterCount === "number" && <span>{item.chapterCount} capitulo(s) detectado(s)</span>}
                </div>
              </div>
              <button
                onClick={() => handleImport(item)}
                disabled={importingId !== null}
                className="self-center inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-60 shrink-0"
              >
                {importingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {importingId === item.id ? "Importando" : "Importar"}
              </button>
            </article>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
