"use client";

import type { PlayerStatus } from "@/components/player/types";

export default function BufferingOverlay({ status }: { status: PlayerStatus }) {
  if (status !== "buffering" && status !== "loading") return null;

  return (
    <div className="buffering-overlay" aria-label="Carregando vídeo">
      <div className="buffering-spinner" />
    </div>
  );
}
