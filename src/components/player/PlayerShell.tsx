"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

import EpisodeDrawer from "@/components/player/EpisodeDrawer";
import PlayerControls from "@/components/player/PlayerControls";
import VideoSurface from "@/components/player/VideoSurface";
import { useFullscreen } from "@/components/player/useFullscreen";
import { usePlaybackAnalytics } from "@/components/player/usePlaybackAnalytics";
import { usePlaybackProgress } from "@/components/player/usePlaybackProgress";
import BufferingOverlay from "@/components/player/BufferingOverlay";
import { isDirectSource, sourceLabel, sourceUrl, type PlayerStatus, type WatchPayload } from "@/components/player/types";

export default function PlayerShell({ payload }: { payload: WatchPayload }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [selectedSource, setSelectedSource] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [firstFrameSent, setFirstFrameSent] = useState(false);
  const emit = usePlaybackAnalytics(payload);
  const { saveProgress } = usePlaybackProgress(videoRef, payload, emit);
  const { toggle } = useFullscreen(wrapRef, () => emit("orientation_lock_failed"));

  const url = sourceUrl(payload, selectedSource);
  const direct = isDirectSource(payload, selectedSource);
  const poster = payload.anime?.bannerImage || payload.anime?.coverImage || "";
  const playing = status === "playing" || status === "buffering";

  useEffect(() => {
    emit("player_open", { sourceLabel: sourceLabel(payload, selectedSource), sourceUrl: url });
  }, [emit, payload, selectedSource, url]);

  useEffect(() => {
    const start = Number(payload.history?.progressSec ?? payload.history?.progressSeconds ?? 0);
    const video = videoRef.current;
    if (video && start > 10) video.currentTime = start;
  }, [payload.episodeId, payload.history?.progressSec, payload.history?.progressSeconds]);

  const syncTime = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime || 0);
    setDuration(video.duration || payload.episode?.durationSec || 0);
  }, [payload.episode?.durationSec]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !direct) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [direct]);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !direct) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Number.MAX_SAFE_INTEGER, video.currentTime + seconds));
    syncTime();
  }, [direct, syncTime]);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !direct) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Number.MAX_SAFE_INTEGER, seconds));
    syncTime();
  }, [direct, syncTime]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const enterFullscreen = useCallback(() => {
    void toggle().then((ok) => emit(ok ? "fullscreen_enter" : "player_error", { message: ok ? "fullscreen_enter" : "fullscreen_failed" }));
  }, [emit, toggle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k" || key === "enter") { event.preventDefault(); togglePlay(); }
      if (key === "arrowright" || key === "l") seek(5);
      if (key === "arrowleft" || key === "j") seek(-5);
      if (key === "f") enterFullscreen();
      if (key === "m") toggleMute();
      if (/^[1-9]$/.test(key) && duration > 0) seekTo((Number(key) / 10) * duration);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duration, enterFullscreen, seek, seekTo, toggleMute, togglePlay]);

  const nextHref = useMemo(() => payload.nextEpisode?.href || (payload.nextEpisode?.id ? `/watch/${payload.nextEpisode.id}` : ""), [payload.nextEpisode]);

  if (!url) {
    return (
      <main className="watch-page">
        <section className="watch-stage centered"><AlertTriangle aria-hidden size={34} /><h1>Fonte indisponível</h1><p>O episódio não tem source ativa no momento.</p><Link className="primary-action" href={payload.anime?.slug ? `/anime/${payload.anime.slug}` : "/inicio"}>Voltar</Link></section>
      </main>
    );
  }

  return (
    <main className="watch-page app-player-page">
      <section ref={wrapRef} className="player-shell" data-status={status}>
        <div className="player-topbar">
          <Link className="player-back" href={payload.anime?.slug ? `/anime/${payload.anime.slug}` : "/inicio"}><ArrowLeft aria-hidden size={22} /> <span>{payload.anime?.title || "Voltar"}</span></Link>
          <div className="source-switcher">
            {(payload.sources?.length || 0) > 1 ? payload.sources?.map((source, index) => <button key={`${source.url}:${index}`} className={selectedSource === index ? "source-pill active" : "source-pill"} type="button" onClick={() => { setSelectedSource(index); emit("source_changed", { sourceLabel: sourceLabel(payload, index), sourceUrl: source.url }); }}>{sourceLabel(payload, index)}</button>) : null}
          </div>
        </div>

        <BufferingOverlay status={status} />

        <VideoSurface
          videoRef={videoRef}
          url={url}
          direct={direct}
          poster={poster}
          title={payload.episode?.title || "Player"}
          onReady={() => { setStatus("ready"); syncTime(); if (!firstFrameSent) { setFirstFrameSent(true); emit("first_frame"); } }}
          onPlay={() => { setStatus("playing"); emit("episode_resume"); }}
          onPause={() => { setStatus("paused"); emit("episode_pause"); void saveProgress(true); }}
          onWaiting={() => { setStatus("buffering"); emit("buffer_start"); }}
          onPlaying={() => { setStatus("playing"); emit("buffer_end"); }}
          onEnded={() => { setStatus("ended"); emit("episode_complete"); void saveProgress(true, true); }}
          onError={() => { setStatus("fatal_error"); emit("player_error", { sourceUrl: url }); }}
          onTime={syncTime}
        />

        {direct ? (
          <PlayerControls
            status={status}
            playing={playing}
            muted={muted}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSeekTo={seekTo}
            onToggleMute={toggleMute}
            onFullscreen={enterFullscreen}
            onDrawer={() => setDrawerOpen(true)}
          />
        ) : <div className="player-embed-hint"><span>Embed protegido em sandbox</span><button type="button" onClick={enterFullscreen}>Tela cheia</button></div>}
      </section>

      <section className="watch-meta app-watch-meta">
        <p className="eyebrow">T{payload.episode?.season || 1} E{payload.episode?.number || 1}</p>
        <h1>{payload.episode?.title || "Episódio"}</h1>
        <p>{payload.episode?.description || "Sem descrição para este episódio."}</p>
        <div className="hero-actions">
          {nextHref ? <Link className="primary-action" href={nextHref}>Próximo episódio</Link> : null}
          <button className="secondary-action" type="button" onClick={() => setDrawerOpen(true)}>Todos os episódios</button>
        </div>
      </section>
      <EpisodeDrawer open={drawerOpen} currentId={payload.episodeId} items={payload.playlist || []} onClose={() => setDrawerOpen(false)} />
    </main>
  );
}
