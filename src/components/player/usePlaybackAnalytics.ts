"use client";

import { useCallback } from "react";

import type { WatchPayload } from "@/components/player/types";

type AnalyticsPayload = Record<string, unknown>;

export function usePlaybackAnalytics(payload: WatchPayload | null) {
  return useCallback(
    (event: string, extra: AnalyticsPayload = {}) => {
      if (!payload) return;
      fetch("/api/watch/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          animeId: payload.anime?.id,
          episodeId: payload.episodeId,
          path: typeof window !== "undefined" ? window.location.pathname : "",
          ...extra,
        }),
      }).catch(() => {});
    },
    [payload],
  );
}
