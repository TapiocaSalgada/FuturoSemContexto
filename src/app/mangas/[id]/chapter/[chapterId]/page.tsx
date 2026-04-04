"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

import AppLayout from "@/components/AppLayout";

type MangaChapter = {
  id: string;
  chapterNumber?: number | null;
  volumeNumber?: number | null;
  title?: string | null;
  externalUrl?: string | null;
};

type MangaDetails = {
  id: string;
  title: string;
  chapters: MangaChapter[];
};

type ReaderPayload = {
  chapter: {
    id: string;
    title?: string | null;
    chapterNumber?: number | null;
    volumeNumber?: number | null;
    mangaId: string;
    mangaTitle: string;
  };
  quality: "high" | "low";
  pages: number;
  images: string[];
};

function sortChapters(chapters: MangaChapter[]) {
  return [...chapters].sort((a, b) => {
    const av = a.chapterNumber ?? Number.MAX_SAFE_INTEGER;
    const bv = b.chapterNumber ?? Number.MAX_SAFE_INTEGER;
    if (av !== bv) return av - bv;
    return a.id.localeCompare(b.id);
  });
}

export default function MangaChapterReaderPage() {
  const params = useParams();
  const router = useRouter();
  const mangaId = String(params?.id || "");
  const chapterId = String(params?.chapterId || "");

  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [reader, setReader] = useState<ReaderPayload | null>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [loadingManga, setLoadingManga] = useState(true);
  const [loadingReader, setLoadingReader] = useState(true);
  const [readerError, setReaderError] = useState("");
  const [refreshingTokens, setRefreshingTokens] = useState(false);
  const readerRequestRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const refreshAttemptsRef = useRef(0);

  useEffect(() => {
    if (!mangaId) return;
    let alive = true;
    setLoadingManga(true);

    fetch(`/api/mangas/${mangaId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setManga(data);
      })
      .finally(() => {
        if (alive) setLoadingManga(false);
      });

    return () => {
      alive = false;
    };
  }, [mangaId]);

  const loadReader = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!chapterId) return;

      const silent = Boolean(options?.silent);
      const requestId = ++readerRequestRef.current;

      if (!silent) {
        setLoadingReader(true);
        setReaderError("");
      }

      try {
        const query = quality === "low" ? "?quality=low" : "";
        const response = await fetch(`/api/mangas/chapter/${chapterId}${query}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao carregar leitor.");
        }

        if (requestId !== readerRequestRef.current) return;
        setReader(payload);
        setReaderError("");
      } catch (error: any) {
        if (requestId !== readerRequestRef.current) return;

        if (silent) {
          setReaderError("Falha ao renovar acesso das páginas. Recarregue o capítulo.");
          return;
        }

        setReader(null);
        setReaderError(error?.message || "Erro ao carregar capítulo.");
      } finally {
        if (!silent && requestId === readerRequestRef.current) {
          setLoadingReader(false);
        }
      }
    },
    [chapterId, quality],
  );

  useEffect(() => {
    refreshInFlightRef.current = false;
    refreshAttemptsRef.current = 0;
    setRefreshingTokens(false);
    void loadReader();
  }, [loadReader]);

  const handleImageLoadError = useCallback(() => {
    if (refreshInFlightRef.current) return;
    if (refreshAttemptsRef.current >= 1) return;

    refreshInFlightRef.current = true;
    refreshAttemptsRef.current += 1;
    setRefreshingTokens(true);

    void loadReader({ silent: true }).finally(() => {
      refreshInFlightRef.current = false;
      setRefreshingTokens(false);
    });
  }, [loadReader]);

  const orderedChapters = useMemo(() => sortChapters(manga?.chapters || []), [manga?.chapters]);
  const currentIndex = orderedChapters.findIndex((chapter) => chapter.id === chapterId);
  const prevChapter = currentIndex > 0 ? orderedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 ? orderedChapters[currentIndex + 1] || null : null;
  const chapterTitle =
    reader?.chapter.title ||
    orderedChapters.find((chapter) => chapter.id === chapterId)?.title ||
    "Capítulo";

  return (
    <AppLayout>
      <div className="px-0 md:px-8 pb-28 md:pb-24 max-w-6xl mx-auto space-y-4">
        <div className="sticky top-[calc(68px+env(safe-area-inset-top,0px))] z-20 px-3 md:px-0 space-y-2">
          <div className="rounded-2xl border border-white/12 bg-black/70 backdrop-blur-xl p-2.5 flex flex-wrap items-center gap-2 justify-between">
            <Link href={`/mangas/${mangaId}`} className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-xs sm:text-sm rounded-full px-3 py-1.5 border border-white/12 bg-white/5">
              <ArrowLeft size={14} /> Voltar para detalhes
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuality("high")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-black border ${quality === "high" ? "bg-white text-black border-white/60" : "bg-black/35 text-zinc-400 border-white/12 hover:text-white hover:border-white/30"}`}
              >
                Qualidade alta
              </button>
              <button
                type="button"
                onClick={() => setQuality("low")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-black border ${quality === "low" ? "bg-white text-black border-white/60" : "bg-black/35 text-zinc-400 border-white/12 hover:text-white hover:border-white/30"}`}
              >
                Economia
              </button>
            </div>
          </div>

          <section className="rounded-2xl border border-white/12 bg-black/70 backdrop-blur-xl p-3 md:p-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={!prevChapter}
              onClick={() => prevChapter && router.push(`/mangas/${mangaId}/chapter/${prevChapter.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/35 border border-white/12 text-zinc-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black"
            >
              <ChevronLeft size={14} /> Anterior
            </button>

            <div className="text-center min-w-0">
              <p className="text-zinc-400 text-[11px] truncate">{manga?.title || "Manga"}</p>
              <h1 className="text-white text-sm md:text-base font-black truncate">
                Cap. {reader?.chapter.chapterNumber ?? "?"}
                {chapterTitle ? ` - ${chapterTitle}` : ""}
              </h1>
            </div>

            <button
              type="button"
              disabled={!nextChapter}
              onClick={() => nextChapter && router.push(`/mangas/${mangaId}/chapter/${nextChapter.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/35 border border-white/12 text-zinc-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black"
            >
              Próximo <ChevronRight size={14} />
            </button>
          </section>
        </div>

        {refreshingTokens && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 text-sm p-4 mx-4 md:mx-0">
            Renovando acesso das páginas para continuar a leitura...
          </div>
        )}

        {loadingManga || loadingReader ? (
          <div className="min-h-[40vh] flex items-center justify-center text-zinc-400 text-sm gap-2 px-4">
            <Loader2 size={16} className="animate-spin" /> Carregando capítulo...
          </div>
        ) : readerError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm p-4 mx-4 md:mx-0">
            {readerError}
          </div>
        ) : !reader || reader.images.length === 0 ? (
          <div className="rounded-xl border border-white/10 glass-card text-zinc-400 text-sm p-4 mx-4 md:mx-0">
            Sem páginas para esse capítulo.
          </div>
        ) : (
          <div className="space-y-4">
            {reader.images.map((image, index) => (
              <div key={`${image}-${index}`} className="max-w-5xl mx-auto">
                <img
                  src={image}
                  alt={`Página ${index + 1}`}
                  loading="lazy"
                  onError={(event) => {
                    if (event.currentTarget.dataset.retryTrigger === "1") return;
                    event.currentTarget.dataset.retryTrigger = "1";
                    handleImageLoadError();
                  }}
                  className="w-full h-auto bg-black border-y border-white/10 md:border md:rounded-lg"
                />
              </div>
            ))}
            {orderedChapters[currentIndex]?.externalUrl && (
              <div className="text-center pt-2">
                <a
                  href={orderedChapters[currentIndex]?.externalUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-200"
                >
                  <ExternalLink size={13} /> Abrir fonte original no MangaDex
                </a>
              </div>
            )}
          </div>
        )}

        {!loadingReader && !readerError && (
          <div className="md:hidden fixed bottom-[calc(78px+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 rounded-2xl border border-white/12 bg-black/75 backdrop-blur-xl p-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!prevChapter}
              onClick={() => prevChapter && router.push(`/mangas/${mangaId}/chapter/${prevChapter.id}`)}
              className="h-10 rounded-xl border border-white/12 bg-white/5 text-zinc-200 text-xs font-black disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1.5"><ChevronLeft size={14} /> Anterior</span>
            </button>
            <button
              type="button"
              disabled={!nextChapter}
              onClick={() => nextChapter && router.push(`/mangas/${mangaId}/chapter/${nextChapter.id}`)}
              className="h-10 rounded-xl border border-white/12 bg-white/5 text-zinc-200 text-xs font-black disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1.5">Próximo <ChevronRight size={14} /></span>
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
