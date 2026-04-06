"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, Search, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type Mode = "suggest_anime" | "bug_site" | "bug_anime";

type SearchAnime = {
  id: string;
  title: string;
  coverImage?: string;
};

type SuggestionButtonProps = {
  variant?: "floating" | "sidebar";
  mobileSidebar?: boolean;
  className?: string;
  forceVisible?: boolean;
};

export default function SuggestionButton({
  variant = "floating",
  mobileSidebar = false,
  className,
  forceVisible = false,
}: SuggestionButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("suggest_anime");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [animeQuery, setAnimeQuery] = useState("");
  const [animeResults, setAnimeResults] = useState<SearchAnime[]>([]);
  const [animeSearching, setAnimeSearching] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<SearchAnime | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const hideButton =
    !forceVisible &&
    (pathname?.startsWith("/admin") ||
      pathname === "/login" ||
      pathname === "/register" ||
      pathname?.startsWith("/watch/") ||
      (pathname?.startsWith("/mangas/") && pathname.includes("/chapter/")));

  const sidebarTriggerClassName =
    className ||
    "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] text-[var(--text-muted)] hover:text-orange-300 hover:bg-white/[0.06]";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode !== "bug_anime") {
      setAnimeResults([]);
      setAnimeSearching(false);
      return;
    }

    const normalized = animeQuery.trim();
    if (normalized.length < 2) {
      setAnimeResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setAnimeSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`);
        if (!res.ok) throw new Error("Erro de busca");
        const data = await res.json();
        const list = Array.isArray(data?.animes) ? data.animes : [];
        setAnimeResults(list.slice(0, 8));
      } catch {
        setAnimeResults([]);
      } finally {
        setAnimeSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [animeQuery, mode, open]);

  const buttonLabel = useMemo(() => {
    if (mode === "bug_site") return "Reportar bug do site";
    if (mode === "bug_anime") return "Reportar bug no anime";
    return "Sugerir anime";
  }, [mode]);

  const resetForm = () => {
    setMode("suggest_anime");
    setTitle("");
    setDescription("");
    setAnimeQuery("");
    setAnimeResults([]);
    setSelectedAnime(null);
    setError("");
    setSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!description.trim() || description.trim().length < 8) {
      setError("Descreva melhor o pedido/bug (mínimo 8 caracteres).");
      return;
    }
    if (mode === "bug_anime" && !selectedAnime) {
      setError("Selecione o anime na busca para reportar o bug.");
      return;
    }

    setLoading(true);
    try {
      const normalizedTitle = title.trim() ||
        (mode === "suggest_anime"
          ? "Sugestão de anime"
          : mode === "bug_site"
            ? "Bug no site"
            : `Bug no anime ${selectedAnime?.title || ""}`.trim());

      const request =
        mode === "suggest_anime"
          ? fetch("/api/suggestions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: `[ANIME] ${normalizedTitle}`,
                description: description.trim(),
              }),
            })
          : fetch("/api/bug-reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                animeId: mode === "bug_anime" ? selectedAnime?.id : null,
                title: normalizedTitle,
                description: description.trim(),
                pagePath: typeof window !== "undefined" ? window.location.pathname : pathname,
              }),
            });

      const res = await request;
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Falha ao enviar. Tente novamente.");
        setLoading(false);
        return;
      }

      setLoading(false);
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1200);
    } catch {
      setLoading(false);
      setError("Erro ao enviar agora. Tente novamente.");
    }
  };

  return (
    <>
      {hideButton ? null : (
        variant === "floating" ? (
            <button
              onClick={() => {
                setOpen(true);
                setError("");
              }}
              className="fixed bottom-[calc(86px+env(safe-area-inset-bottom,0px))] md:bottom-6 right-3 md:right-6 z-[9999] inline-flex items-center gap-2 text-white font-black px-4 py-2.5 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.5)] transition text-xs uppercase tracking-wide border border-white/25 hover:translate-y-[-1px]"
              style={{ background: "linear-gradient(140deg, #c1121f, #7f1d1d)" }}
              title="Sugerir anime ou reportar bug"
            >
            <Bug size={14} />
            <span>Reportar</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setOpen(true);
              setError("");
            }}
            className={sidebarTriggerClassName}
            title="Sugerir anime ou reportar bug"
          >
            <Bug size={20} className="shrink-0" />
            <span className={`font-semibold text-sm ${mobileSidebar ? "block" : "hidden lg:block"}`}>
              Reportar bug
            </span>
          </button>
        )
      )}

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setOpen(false); resetForm(); }} />
          <div className="relative glass-surface-heavy border border-white/12 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-5 md:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-xl flex items-center gap-2">
                <AlertTriangle size={20} className="kdr-section-title-accent" /> Reportar bug
              </h2>
              <button onClick={() => { setOpen(false); resetForm(); }} className="text-[var(--text-muted)] hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-[var(--text-muted)] text-sm">Envie sugestão de anime ou reporte bugs do site/anime com contexto completo.</p>

            {sent ? (
              <div className="py-8 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-bold text-green-400">Enviado com sucesso!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Tipo</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => { setMode("suggest_anime"); setSelectedAnime(null); setAnimeQuery(""); }}
                      className={`py-2.5 rounded-lg border text-[11px] font-black uppercase transition min-h-[44px] ${mode === "suggest_anime" ? "bg-white text-black border-white/70" : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"}`}
                    >
                      Sugerir anime
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode("bug_site"); setSelectedAnime(null); setAnimeQuery(""); }}
                      className={`py-2.5 rounded-lg border text-[11px] font-black uppercase transition min-h-[44px] ${mode === "bug_site" ? "bg-cyan-600 border-cyan-500 text-white" : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-cyan-500/40"}`}
                    >
                      Bug do site
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("bug_anime")}
                      className={`py-2.5 rounded-lg border text-[11px] font-black uppercase transition min-h-[44px] ${mode === "bug_anime" ? "bg-amber-600 border-amber-500 text-white" : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-amber-500/40"}`}
                    >
                      Bug no anime
                    </button>
                  </div>
                </div>

                {mode === "bug_anime" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] block">Selecionar anime *</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        value={animeQuery}
                        onChange={(event) => {
                          setAnimeQuery(event.target.value);
                          setSelectedAnime(null);
                        }}
                        className="kdr-input w-full rounded-lg pl-9 pr-3 py-2.5 text-sm"
                        placeholder="Buscar anime (ex: Jojo)"
                      />
                    </div>

                    {selectedAnime && (
                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 font-semibold">
                        Anime selecionado: {selectedAnime.title}
                      </div>
                    )}

                    {(animeSearching || animeResults.length > 0) && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                        {animeSearching ? (
                          <p className="text-xs text-[var(--text-muted)] px-3 py-2">Buscando...</p>
                        ) : (
                          animeResults.map((anime) => (
                            <button
                              key={anime.id}
                              type="button"
                              onClick={() => {
                                setSelectedAnime(anime);
                                setAnimeQuery(anime.title);
                                setAnimeResults([]);
                              }}
                              className="w-full text-left px-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 text-sm text-[var(--text-secondary)] hover:bg-white/[0.06] transition min-h-[44px]"
                            >
                              {anime.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Título *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    className="kdr-input w-full rounded-lg px-3 py-2.5 text-sm"
                    placeholder={mode === "suggest_anime" ? "Ex: One Piece" : mode === "bug_site" ? "Ex: Erro ao trocar conta" : "Ex: Player travando no anime"} />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 mb-1 block">Detalhes *</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    className="kdr-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[80px] resize-none"
                    placeholder={mode === "suggest_anime" ? "Ex: por que esse anime combina com o catálogo." : "Explique como reproduzir, aparelho e o que esperava acontecer."} />
                </div>

                {error && <p className="text-xs font-bold text-red-400">{error}</p>}

                <button type="submit" disabled={loading}
                  className="kdr-btn-primary w-full h-12 text-sm">
                  <Send size={16} /> {loading ? "Enviando..." : buttonLabel}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
