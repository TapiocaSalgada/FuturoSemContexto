"use client";

import { RefObject, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { isHlsUrl } from "@/components/player/types";

type VideoSurfaceProps = {
  videoRef: RefObject<HTMLVideoElement>;
  url: string;
  direct: boolean;
  poster?: string | null;
  title: string;
  onReady: () => void;
  onPlay: () => void;
  onPause: () => void;
  onWaiting: () => void;
  onPlaying: () => void;
  onEnded: () => void;
  onError: () => void;
  onTime: () => void;
};

export default function VideoSurface({ videoRef, url, direct, poster, title, onReady, onPlay, onPause, onWaiting, onPlaying, onEnded, onError, onTime }: VideoSurfaceProps) {
  const [hlsError, setHlsError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !direct || !url) return;

    setHlsError("");
    let hls: { destroy: () => void; loadSource: (source: string) => void; attachMedia: (media: HTMLMediaElement) => void; on: (...args: any[]) => void } | null = null;
    const canPlayNative = video.canPlayType("application/vnd.apple.mpegurl");

    if (isHlsUrl(url) && !canPlayNative) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (!Hls.isSupported()) {
            setHlsError("Este navegador não suporta HLS via MSE.");
            return;
          }
          hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; details?: string }) => {
            if (data.fatal) {
              setHlsError(data.details || "Erro fatal no HLS.");
              onError();
            }
          });
        })
        .catch(() => setHlsError("Não foi possível carregar HLS.js."));
    } else {
      video.src = url;
    }

    return () => {
      hls?.destroy();
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [direct, onError, url, videoRef]);

  if (!url) {
    return (
      <div className="player-empty">
        <AlertTriangle aria-hidden size={34} />
        <h1>Fonte indisponível</h1>
        <p>O episódio existe, mas nenhuma fonte ativa foi resolvida agora.</p>
      </div>
    );
  }

  if (!direct) {
    return (
      <iframe
        className="player-iframe"
        src={url}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allowFullScreen
      />
    );
  }

  return (
    <>
      {hlsError ? <div className="player-hint danger">{hlsError}</div> : null}
      <video
        ref={videoRef}
        className="player-video"
        poster={poster || undefined}
        playsInline
        preload="metadata"
        onLoadedMetadata={onReady}
        onLoadedData={onReady}
        onPlay={onPlay}
        onPause={onPause}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onEnded={onEnded}
        onError={onError}
        onTimeUpdate={onTime}
      />
    </>
  );
}
