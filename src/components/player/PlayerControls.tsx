"use client";

import { Maximize2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

import type { PlayerStatus } from "@/components/player/types";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type PlayerControlsProps = {
  status: PlayerStatus;
  playing: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSeekTo: (seconds: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onDrawer: () => void;
};

export default function PlayerControls({ status, playing, muted, currentTime, duration, onTogglePlay, onSeek, onSeekTo, onToggleMute, onFullscreen, onDrawer }: PlayerControlsProps) {
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="player-controls" aria-label="Controles do player">
      <div className="player-center-controls">
        <button type="button" aria-label="Voltar 5 segundos" onClick={() => onSeek(-5)}><RotateCcw aria-hidden size={28} /><span>5</span></button>
        <button className="player-main-button" type="button" aria-label={playing ? "Pausar" : "Reproduzir"} onClick={onTogglePlay}>{playing ? <Pause aria-hidden size={38} /> : <Play aria-hidden size={38} />}</button>
        <button type="button" aria-label="Avançar 5 segundos" onClick={() => onSeek(5)}><RotateCw aria-hidden size={28} /><span>5</span></button>
      </div>
      <div className="player-bottom-controls">
        <span>{formatTime(currentTime)}</span>
        <input aria-label="Progresso" type="range" min={0} max={Math.max(1, Math.floor(duration || 1))} value={Math.min(Math.floor(currentTime), Math.floor(duration || currentTime || 0))} onChange={(event) => onSeekTo(Number(event.target.value))} style={{ backgroundSize: `${progress}% 100%` }} />
        <span>{formatTime(duration)}</span>
        <button type="button" aria-label={muted ? "Ativar som" : "Mudo"} onClick={onToggleMute}>{muted ? <VolumeX aria-hidden size={21} /> : <Volume2 aria-hidden size={21} />}</button>
        <button type="button" onClick={onDrawer}>Episódios</button>
        <button type="button" aria-label="Tela cheia" onClick={onFullscreen}><Maximize2 aria-hidden size={21} /></button>
      </div>
      <span className="player-status">{status}</span>
    </div>
  );
}
