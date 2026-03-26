"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  FastForward,
  Play,
  SkipForward,
  Star,
} from "lucide-react";

type EpisodeItem = {
  id: string;
  title: string;
  number: number;
  season: number;
  videoUrl: string;
  sourceType?: string;
  sourceLabel?: string | null;
  introStartSec?: number | null;
  introEndSec?: number | null;
  outroStartSec?: number | null;
  outroEndSec?: number | null;
};

type WatchPayload = {
  anime: {
    id: string;
    title: string;
    bannerImage?: string | null;
    coverImage?: string | null;
    episodes: EpisodeItem[];
  };
  episode: EpisodeItem;
  episodeId: string;
  videoToPlay: string;
  embedUrl: string;
  epTitle: string;
  playlist: EpisodeItem[];
  nextEpisode?: EpisodeItem | null;
  prevEpisode?: EpisodeItem | null;
  history?: { progressSec: number; watched: boolean } | null;
  viewerSettings: {
    autoplay: boolean;
    resumePlayback: boolean;
    playbackSpeed: string;
  };
  sourceType: string;
  isDirectSource: boolean;
};

function formatSeasonLabel(episode: EpisodeItem) {
  return `T${episode.season} · Ep ${episode.number}`;
}

// SVG ring countdown component
function CountdownRing({ total, current }: { total: number; current: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const progress = (current / total) * circ;
  return (
    <svg width="96" height="96" className="rotate-[-90deg]">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke="rgb(var(--theme-500))" strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ - progress}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

export default function WatchPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const autoplayTimeout = useRef<ReturnType<typeof setInterval>>();
  const [data, setData] = useState<WatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeApplied, setResumeApplied] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const AUTOPLAY_SECONDS = 10;

  // ── Rating state ──
  const [ratingData, setRatingData] = useState<{ average: number | null; total: number; userRating: number | null }>({
    average: null, total: 0, userRating: null,
  });
  const [ratingHover, setRatingHover] = useState(0);

  useEffect(() => {
    setLoading(true);
    setResumeApplied(false);
    setAutoplayCountdown(null);
    setShowSkipIntro(false);
    setShowSkipOutro(false);
    clearInterval(autoplayTimeout.current);

    fetch(`/api/watch/${params.id}`)
      .then((r) => r.json())
      .then((payload) => {
        setData(payload);
        setLoading(false);
        // fetch rating for this anime
        if (payload?.anime?.id) {
          fetch(`/api/ratings?animeId=${payload.anime.id}`).then(r => r.json()).then(setRatingData);
        }
      });

    return () => clearInterval(autoplayTimeout.current);
  }, [params.id]);

  // ── Playback speed ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.isDirectSource) return;
    const speed = parseFloat(data.viewerSettings.playbackSpeed === "Normal" ? "1" : data.viewerSettings.playbackSpeed);
    video.playbackRate = Number.isFinite(speed) ? speed : 1;
  }, [data]);

  // ── Resume playback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.isDirectSource || !data.history || resumeApplied) return;
    const applyResume = () => {
      if (!data.history?.progressSec) return;
      video.currentTime = data.history.progressSec;
      setResumeApplied(true);
    };
    video.addEventListener("loadedmetadata", applyResume);
    return () => video.removeEventListener("loadedmetadata", applyResume);
  }, [data, resumeApplied]);

  // ── Save progress every 10s ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.isDirectSource || !data.episodeId || !session?.user) return;
    const interval = setInterval(() => {
      if (!video.paused && Number.isFinite(video.currentTime)) {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: data.episodeId, progressSec: Math.floor(video.currentTime), watched: video.ended }),
        });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data, session]);

  // ── Keyboard shortcuts (MP4 only) ──
  useEffect(() => {
    if (!data?.isDirectSource) return;
    const video = videoRef.current;
    const wrapper = playerWrapRef.current;
    if (!video) return;

    const handler = (e: KeyboardEvent) => {
      // Don't steal keys when typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "KeyF":
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen();
          else wrapper?.requestFullscreen();
          break;
        case "KeyM":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        default:
          // 0-9 → jump to % of video
          if (e.code.startsWith("Digit")) {
            e.preventDefault();
            const pct = parseInt(e.code.replace("Digit", "")) / 10;
            if (Number.isFinite(video.duration)) video.currentTime = video.duration * pct;
          }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data]);

  const groupedEpisodes = useMemo(() => {
    if (!data?.playlist) return {} as Record<number, EpisodeItem[]>;
    return data.playlist.reduce<Record<number, EpisodeItem[]>>((groups, episode) => {
      if (!groups[episode.season]) groups[episode.season] = [];
      groups[episode.season].push(episode);
      return groups;
    }, {});
  }, [data]);

  const handleTimeUpdate = () => {
    if (!data?.episode || !videoRef.current) return;
    const t = videoRef.current.currentTime;
    const { introStartSec, introEndSec, outroStartSec, outroEndSec } = data.episode;

    // Skip Intro
    if (introStartSec != null && introEndSec != null) {
      setShowSkipIntro(t >= introStartSec && t < introEndSec);
    } else {
      setShowSkipIntro(false);
    }

    // Skip Outro
    if (outroStartSec != null && outroEndSec != null) {
      setShowSkipOutro(t >= outroStartSec && t < outroEndSec);
    } else {
      setShowSkipOutro(false);
    }
  };

  const handleSkipIntro = () => {
    if (!videoRef.current || !data?.episode.introEndSec) return;
    videoRef.current.currentTime = data.episode.introEndSec;
    setShowSkipIntro(false);
  };

  const handleSkipOutro = () => {
    if (!videoRef.current || !data?.episode.outroEndSec) return;
    videoRef.current.currentTime = data.episode.outroEndSec;
    setShowSkipOutro(false);
  };

  const handleEnded = () => {
    if (!data?.episodeId) return;
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: data.episodeId, progressSec: Math.floor(videoRef.current?.duration || 0), watched: true }),
    });

    if (!data.nextEpisode || !data.viewerSettings.autoplay) return;

    setAutoplayCountdown(AUTOPLAY_SECONDS);
    autoplayTimeout.current = setInterval(() => {
      setAutoplayCountdown((current) => {
        if (current === null) return current;
        if (current <= 1) {
          clearInterval(autoplayTimeout.current);
          router.push(`/watch/${data.nextEpisode?.id}`);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const cancelAutoplay = () => {
    clearInterval(autoplayTimeout.current);
    setAutoplayCountdown(null);
  };

  const handleRate = async (star: number) => {
    if (!data?.anime?.id || !session) return;
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: data.anime.id, rating: star }),
    });
    const updated = await res.json();
    if (updated.ok !== false) setRatingData(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center text-pink-500">
        Carregando player...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center text-white">
        Video nao encontrado.
      </div>
    );
  }

  const isDrive = data.embedUrl?.includes("drive.google.com") || data.videoToPlay?.includes("drive.google.com");

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/anime/${data.anime.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition border border-white/5"
          >
            <ArrowLeft size={16} /> Voltar para o anime
          </Link>
          {data.nextEpisode && (
            <Link
              href={`/watch/${data.nextEpisode.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-bold transition"
            >
              Próximo Episódio <SkipForward size={16} />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <section className="space-y-4">
            {/* ── Player ── */}
            <div ref={playerWrapRef} className="relative rounded-[28px] overflow-hidden border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
              <div className="aspect-video relative">
                {data.isDirectSource ? (
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    className="w-full h-full outline-none"
                    poster={data.anime.bannerImage || data.anime.coverImage || ""}
                  >
                    <source src={data.videoToPlay} type="video/mp4" />
                    Seu navegador nao suporta este formato de video.
                  </video>
                ) : (
                  <>
                    <iframe
                      src={data.embedUrl}
                      className="w-full h-full outline-none"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                    />
                    {/* ── Block Google Drive top-right escape buttons ── */}
                    {isDrive && (
                      <>
                        {/* Top bar overlay – covers the top-right ~25% of the player */}
                        <div
                          className="absolute top-0 right-0 h-12 w-[40%] z-50"
                          style={{ pointerEvents: "all", background: "transparent", cursor: "default" }}
                          onClick={(e) => e.preventDefault()}
                        />
                        {/* Extra block for mobile where the button renders lower */}
                        <div
                          className="absolute bottom-12 right-0 h-12 w-[40%] z-50"
                          style={{ pointerEvents: "all", background: "transparent", cursor: "default" }}
                          onClick={(e) => e.preventDefault()}
                        />
                      </>
                    )}
                  </>
                )}

                {/* Skip Intro */}
                {showSkipIntro && (
                  <button
                    onClick={handleSkipIntro}
                    className="absolute right-4 bottom-16 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-black hover:bg-pink-500 hover:text-white transition shadow-lg z-30"
                  >
                    <FastForward size={16} /> Pular abertura
                  </button>
                )}

                {/* Skip Outro */}
                {showSkipOutro && (
                  <button
                    onClick={handleSkipOutro}
                    className="absolute right-4 bottom-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-black hover:bg-pink-500 hover:text-white transition shadow-lg z-30"
                  >
                    <FastForward size={16} /> Pular encerramento
                  </button>
                )}

                {/* Auto-play countdown with SVG ring */}
                {autoplayCountdown !== null && data.nextEpisode && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-40">
                    <div className="max-w-sm w-full rounded-3xl bg-[#111] border border-white/10 p-6 text-center space-y-4">
                      <p className="text-zinc-400 text-sm">Episódio concluído</p>
                      {/* Countdown ring */}
                      <div className="relative inline-flex items-center justify-center">
                        <CountdownRing total={AUTOPLAY_SECONDS} current={autoplayCountdown} />
                        <span className="absolute text-2xl font-black text-white">{autoplayCountdown}</span>
                      </div>
                      <h3 className="text-xl font-black text-white">{data.nextEpisode.title}</h3>
                      <p className="text-zinc-500 text-xs">Próximo episódio iniciando automaticamente...</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/watch/${data.nextEpisode?.id}`)}
                          className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-2xl transition"
                        >
                          <Play size={14} className="inline mr-1" /> Assistir agora
                        </button>
                        <button
                          onClick={cancelAutoplay}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-2xl transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Previous / Next Buttons (Below Player) ── */}
            {(data.prevEpisode || data.nextEpisode) && (
              <div className="flex items-center gap-3 w-full">
                {data.prevEpisode && (
                  <Link
                    href={`/watch/${data.prevEpisode.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-[20px] bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 text-white font-bold transition group"
                  >
                    <SkipForward size={18} className="rotate-180 text-zinc-400 group-hover:text-white transition" />
                    Episódio Anterior
                  </Link>
                )}

                {data.nextEpisode && (
                  <Link
                    href={`/watch/${data.nextEpisode.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-[20px] bg-pink-600 hover:bg-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.3)] text-white font-bold transition group"
                  >
                    Próximo Episódio
                    <SkipForward size={18} className="text-pink-300 group-hover:text-white transition" />
                  </Link>
                )}
              </div>
            )}

            {/* ── Info + Rating ── */}
            <div className="bg-zinc-900/55 border border-zinc-800 rounded-[28px] p-5 lg:p-6">
              <div className="flex items-center gap-3 flex-wrap">
                <img src="/logo.png" alt="Futuro sem Contexto" className="w-10 h-10 rounded-2xl object-cover" />
                <div>
                  <p className="text-sm text-pink-400 font-black uppercase tracking-[0.18em]">Futuro sem Contexto</p>
                  <h1 className="text-2xl lg:text-3xl font-black text-white">{data.anime.title}</h1>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-zinc-800 text-white font-bold">{formatSeasonLabel(data.episode)}</span>
                <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  Fonte: {data.episode.sourceLabel || data.sourceType.replace("_", " ")}
                </span>
                {data.history?.progressSec ? (
                  <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 inline-flex items-center gap-1">
                    <Clock3 size={14} /> Retomando de {Math.floor(data.history.progressSec / 60)}m
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-zinc-400 text-sm leading-relaxed">{data.epTitle}</p>

              {/* ── Star Rating ── */}
              {session && (
                <div className="mt-5 pt-4 border-t border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">
                    {ratingData.average ? `★ ${ratingData.average} / 5 (${ratingData.total} votos)` : "Avalie este anime"}
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        onMouseEnter={() => setRatingHover(star)}
                        onMouseLeave={() => setRatingHover(0)}
                        className="transition-transform hover:scale-125"
                      >
                        <Star
                          size={26}
                          className={`transition ${
                            star <= (ratingHover || ratingData.userRating || 0)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-zinc-600"
                          }`}
                        />
                      </button>
                    ))}
                    {ratingData.userRating && (
                      <span className="ml-2 text-xs text-zinc-500">Sua nota: {ratingData.userRating}★</span>
                    )}
                  </div>
                </div>
              )}

              {/* Keyboard shortcut hint (desktop only) */}
              {data.isDirectSource && (
                <p className="mt-3 text-[11px] text-zinc-600 hidden md:block">
                  Atalhos: <kbd className="bg-zinc-800 px-1 rounded">Espaço</kbd> pausar &nbsp;
                  <kbd className="bg-zinc-800 px-1 rounded">←/→</kbd> ±5s &nbsp;
                  <kbd className="bg-zinc-800 px-1 rounded">F</kbd> tela cheia &nbsp;
                  <kbd className="bg-zinc-800 px-1 rounded">M</kbd> mudo &nbsp;
                  <kbd className="bg-zinc-800 px-1 rounded">0-9</kbd> pular %
                </p>
              )}
            </div>
          </section>

          {/* ── Playlist Sidebar ── */}
          <aside className="bg-zinc-900/55 border border-zinc-800 rounded-[28px] p-4 lg:p-5 xl:sticky xl:top-20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-[0.2em]">Playlist</p>
                <h2 className="text-lg font-black text-white">{data.playlist.length} episódios</h2>
              </div>
              {data.nextEpisode && (
                <Link
                  href={`/watch/${data.nextEpisode.id}`}
                  className="w-10 h-10 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white inline-flex items-center justify-center transition"
                >
                  <SkipForward size={16} />
                </Link>
              )}
            </div>

            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {Object.entries(groupedEpisodes).map(([season, episodes]) => (
                <div key={season}>
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.18em] mb-2">Temporada {season}</p>
                  <div className="space-y-2">
                    {episodes.map((episode) => {
                      const active = episode.id === data.episode.id;
                      return (
                        <Link
                          key={episode.id}
                          href={`/watch/${episode.id}`}
                          className={`block rounded-2xl border px-3 py-3 transition ${
                            active
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                                active ? "bg-pink-500 text-white" : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {episode.number}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate">{episode.title}</p>
                              <p className="text-xs text-zinc-500 mt-1">{formatSeasonLabel(episode)}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
