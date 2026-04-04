"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import AppLayout from "@/components/AppLayout";
import { buildImageCandidates } from "@/lib/image-quality";

type MangaChapter = {
  id: string;
  chapterNumber?: number | null;
  volumeNumber?: number | null;
  title?: string | null;
  language?: string | null;
  pages?: number | null;
  externalUrl?: string | null;
  externalId?: string | null;
  scanlationTeam?: string | null;
  publishedAt?: string | null;
};

type MangaDetails = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  status?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  malUrl?: string | null;
  createdAt?: string | null;
  chapters: MangaChapter[];
  categories: { id: string; name: string }[];
};

function normalizeLanguage(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  return raw || "unknown";
}

function languageLabel(value?: string | null) {
  const code = normalizeLanguage(value);
  if (code === "pt" || code === "pt-br") return "Brazilian Portuguese";
  if (code === "en") return "English";
  if (code === "es" || code === "es-la") return "Spanish";
  if (code === "ja") return "Japanese";
  if (code === "unknown") return "Unknown";
  return code.toUpperCase();
}

function languageCodeLabel(value?: string | null) {
  const code = normalizeLanguage(value);
  if (code === "pt-br") return "PT";
  if (code === "es-la") return "ES";
  if (code === "unknown") return "--";
  return code.slice(0, 2).toUpperCase();
}

function formatChapterNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "?";
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatStatus(value?: string | null) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "ongoing") return "ongoing";
  if (status === "completed") return "completed";
  return status || "unknown";
}

function pickNextImageCandidate(target: HTMLImageElement) {
  const candidates = String(target.dataset.candidates || "")
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
  const currentIndex = Number(target.dataset.candidateIndex || "0");
  const nextIndex = Number.isFinite(currentIndex) ? currentIndex + 1 : 1;
  if (nextIndex < candidates.length) {
    target.dataset.candidateIndex = String(nextIndex);
    target.src = candidates[nextIndex];
  }
}

export default function MangaDetailsPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!id) return;
    let alive = true;

    fetch(`/api/mangas/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setManga(data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  const chaptersOrdered = useMemo(() => {
    if (!manga?.chapters) return [];

    const sorted = [...manga.chapters].sort((a, b) => {
      const avol = a.volumeNumber ?? Number.MAX_SAFE_INTEGER;
      const bvol = b.volumeNumber ?? Number.MAX_SAFE_INTEGER;
      if (avol !== bvol) return avol - bvol;
      const av = a.chapterNumber ?? Number.MAX_SAFE_INTEGER;
      const bv = b.chapterNumber ?? Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av - bv;
      return a.id.localeCompare(b.id);
    });

    if (sortOrder === "desc") {
      sorted.reverse();
    }

    return sorted;
  }, [manga?.chapters, sortOrder]);

  const languageOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chapter of manga?.chapters || []) {
      const key = normalizeLanguage(chapter.language);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [manga?.chapters]);

  const visibleChapters = useMemo(() => {
    if (languageFilter === "all") return chaptersOrdered;
    return chaptersOrdered.filter((chapter) => normalizeLanguage(chapter.language) === languageFilter);
  }, [languageFilter, chaptersOrdered]);

  useEffect(() => {
    if (languageFilter === "all") return;
    if (!languageOptions.some((option) => option.value === languageFilter)) {
      setLanguageFilter("all");
    }
  }, [languageFilter, languageOptions]);

  const launchYear = useMemo(() => {
    const chapterYears = (manga?.chapters || [])
      .map((chapter) => {
        if (!chapter.publishedAt) return null;
        const year = new Date(chapter.publishedAt).getFullYear();
        return Number.isFinite(year) && year > 0 ? year : null;
      })
      .filter((year): year is number => year !== null);

    if (chapterYears.length > 0) {
      return Math.min(...chapterYears);
    }

    if (manga?.createdAt) {
      const fallback = new Date(manga.createdAt).getFullYear();
      return Number.isFinite(fallback) ? fallback : null;
    }

    return null;
  }, [manga?.chapters, manga?.createdAt]);

  const genreText = useMemo(() => {
    if (!manga?.categories || manga.categories.length === 0) return "not informed";
    return manga.categories.map((category) => category.name).join(" ");
  }, [manga?.categories]);

  const totalChapters = manga?.chapters?.length || 0;
  const coverCandidates = buildImageCandidates(manga?.coverImage, manga?.bannerImage);
  const initialCover = coverCandidates[0] || "/logo.png";
  const encodedCoverCandidates = coverCandidates.join("||");

  return (
    <AppLayout>
      <div className="p-4 sm:p-5 lg:p-8 pb-28 md:pb-24 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/80 px-3 py-2">
          <Link href="/mangas" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-sm">
            <ArrowLeft size={14} /> Manga Project
          </Link>
          <span className="text-[11px] text-zinc-500">{totalChapters} chapter(s)</span>
        </div>

        {loading ? (
          <div className="text-zinc-400 text-sm">Carregando manga...</div>
        ) : !manga ? (
          <div className="text-zinc-400 text-sm">Manga nao encontrado.</div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/12 bg-black/85 p-3 md:p-4">
              <div className="grid grid-cols-[98px_1fr] sm:grid-cols-[120px_1fr] md:grid-cols-[170px_1fr] gap-3 md:gap-5 items-start">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/12 bg-zinc-900">
                  <img
                    src={initialCover}
                    data-candidates={encodedCoverCandidates}
                    data-candidate-index="0"
                    alt={manga.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(event) => pickNextImageCandidate(event.currentTarget)}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-zinc-100"><span className="font-black text-white">Title:</span> {manga.title}</p>
                  <p className="text-zinc-200 leading-relaxed whitespace-pre-line">
                    <span className="font-black text-white">Description:</span>{" "}
                    {manga.description || "No description available."}
                  </p>
                  <p className="text-zinc-100"><span className="font-black text-white">Type:</span> manga</p>
                  <p className="text-zinc-100"><span className="font-black text-white">Lauching year:</span> {launchYear || "n/d"}</p>
                  <p className="text-zinc-100"><span className="font-black text-white">Status:</span> {formatStatus(manga.status)}</p>
                  <p className="text-zinc-100"><span className="font-black text-white">Genre:</span> {genreText}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {manga.source && (
                      <span className="px-2 py-1 rounded-full border border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.1em] text-zinc-300 font-black">
                        Source: {manga.source}
                      </span>
                    )}
                    {manga.sourceUrl && (
                      <a
                        href={manga.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-full bg-white/10 border border-white/25 text-zinc-100 hover:bg-white hover:text-black transition text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} /> Site original
                      </a>
                    )}
                    {manga.malUrl && (
                      <a
                        href={manga.malUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-300/35 text-blue-100 hover:bg-blue-500/20 transition text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} /> MyAnimeList
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/12 bg-black/80 p-3 md:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="manga-language" className="text-xs text-zinc-300 font-bold">Language</label>
                  <select
                    id="manga-language"
                    value={languageFilter}
                    onChange={(event) => setLanguageFilter(event.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs min-w-0 flex-1 sm:flex-none"
                  >
                    <option value="all">All ({totalChapters})</option>
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {languageLabel(option.value)} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSortOrder((current) => (current === "desc" ? "asc" : "desc"))}
                  className="h-8 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold hover:bg-zinc-700 transition w-full sm:w-auto"
                >
                  {sortOrder === "desc" ? "Descending" : "Ascending"}
                </button>
              </div>

              {visibleChapters.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sem capitulos para esse filtro.</p>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {visibleChapters.map((chapter) => (
                      <div key={chapter.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-zinc-100 font-semibold truncate inline-flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-black text-red-200 inline-flex items-center justify-center shrink-0">
                              {languageCodeLabel(chapter.language)}
                            </span>
                            <span className="truncate">{languageLabel(chapter.language)}</span>
                          </p>
                          <span className="text-xs text-zinc-400 shrink-0">Cap. {formatChapterNumber(chapter.chapterNumber)}</span>
                        </div>

                        {(chapter.title || chapter.scanlationTeam) && (
                          <p className="text-[11px] text-zinc-500 truncate">
                            {chapter.title || chapter.scanlationTeam}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <span>{chapter.volumeNumber ? `Volume - ${chapter.volumeNumber}` : "Sem volume"}</span>
                          {chapter.pages ? <span>{chapter.pages} pages</span> : <span>-</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {chapter.externalId ? (
                            <Link
                              href={`/mangas/${id}/chapter/${chapter.id}`}
                              className="h-8 rounded-md bg-white text-black text-xs font-black inline-flex items-center justify-center"
                            >
                              Ler aqui
                            </Link>
                          ) : (
                            <span className="h-8 rounded-md border border-zinc-700 text-zinc-500 text-xs inline-flex items-center justify-center">
                              n/a
                            </span>
                          )}

                          {chapter.externalUrl ? (
                            <a
                              href={chapter.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 rounded-md border border-white/20 text-zinc-300 hover:text-white hover:border-white/40 text-xs font-bold inline-flex items-center justify-center"
                              title="Abrir capitulo no site original"
                            >
                              Original
                            </a>
                          ) : (
                            <span className="h-8 rounded-md border border-zinc-700 text-zinc-600 text-xs inline-flex items-center justify-center">
                              sem link
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-white/10 overflow-hidden hidden md:block">
                    <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_auto] gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-zinc-500 bg-zinc-900/70 border-b border-white/10">
                      <span>Language</span>
                      <span>Volume</span>
                      <span>Chapter</span>
                      <span className="text-right">Action</span>
                    </div>

                    <div className="max-h-[65vh] overflow-y-auto divide-y divide-white/10">
                      {visibleChapters.map((chapter) => (
                        <div key={chapter.id} className="grid grid-cols-[1.4fr_0.8fr_0.7fr_auto] gap-2 px-3 py-2.5 text-sm items-center hover:bg-white/[0.03] transition">
                          <div className="min-w-0">
                            <p className="text-zinc-100 font-semibold truncate inline-flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-black text-red-200 inline-flex items-center justify-center">
                                {languageCodeLabel(chapter.language)}
                              </span>
                              <span className="truncate">{languageLabel(chapter.language)}</span>
                            </p>
                            {chapter.scanlationTeam && (
                              <p className="text-[11px] text-zinc-500 truncate">{chapter.scanlationTeam}</p>
                            )}
                          </div>

                          <p className="text-zinc-300 text-xs">{chapter.volumeNumber ? `Volume - ${chapter.volumeNumber}` : "-"}</p>
                          <p className="text-zinc-200 font-semibold">{formatChapterNumber(chapter.chapterNumber)}</p>

                          <div className="flex items-center justify-end gap-1.5">
                            {chapter.externalId ? (
                              <Link
                                href={`/mangas/${id}/chapter/${chapter.id}`}
                                className="px-2.5 h-7 rounded-md bg-white text-black text-xs font-black inline-flex items-center"
                              >
                                Ler
                              </Link>
                            ) : (
                              <span className="px-2.5 h-7 rounded-md border border-zinc-700 text-zinc-500 text-xs inline-flex items-center">
                                n/a
                              </span>
                            )}

                            {chapter.externalUrl && (
                              <a
                                href={chapter.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 h-7 rounded-md border border-white/20 text-zinc-300 hover:text-white hover:border-white/40 text-xs font-bold inline-flex items-center"
                                title="Abrir capitulo no site original"
                              >
                                Original
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
