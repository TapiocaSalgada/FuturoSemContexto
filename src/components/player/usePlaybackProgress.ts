"use client";

import { RefObject, useCallback, useEffect, useRef } from "react";

import type { WatchPayload } from "@/components/player/types";

export function usePlaybackProgress(videoRef: RefObject<HTMLVideoElement>, payload: WatchPayload | null, emit: (event: string, data?: Record<string, unknown>) => void) {
  const lastSavedRef = useRef(0);

  const saveProgress = useCallback(
    async (force = false, completed = false) => {
      const video = videoRef.current;
      if (!video || !payload?.episodeId) return;
      const progressSec = Math.max(0, Math.floor(video.currentTime || 0));
      const durationSec = Math.max(0, Math.floor(video.duration || payload.episode?.durationSec || 0));
      const watched = completed || (durationSec > 0 && progressSec / durationSec >= 0.9);
      if (!force && !watched && progressSec - lastSavedRef.current < 15) return;
      lastSavedRef.current = progressSec;
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: payload.episodeId, progressSec, durationSec, watched }),
      }).catch(() => {});
      emit("progress_save", { progressSec, durationSec, completed: watched });
    },
    [emit, payload, videoRef],
  );

  useEffect(() => {
    const timer = window.setInterval(() => saveProgress(false), 15000);
    const unload = () => void saveProgress(true);
    window.addEventListener("pagehide", unload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", unload);
      void saveProgress(true);
    };
  }, [saveProgress]);

  return { saveProgress };
}
