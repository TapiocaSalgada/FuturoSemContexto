"use client";

/**
 * Watch page orchestration layer.
 *
 * This file coordinates:
 * - source loading/fallback (direct + compatibility embed)
 * - player lifecycle and mobile immersive behavior
 * - history persistence and telemetry
 * - autoplay/next-episode gating with source-aware thresholds
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Hls from "hls.js";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";

import AppLayout from "@/components/AppLayout";
import TomatoVideoPlayer from "@/components/TomatoVideoPlayer";
import {
  WATCH_PLAYER_DEFAULT_CONFIG,
  normalizeWatchPlayerConfig,
  resolveNextPromptWindowSeconds,
  type WatchPlayerConfigState,
} from "@/lib/watch-player-config";

type EpisodeItem = {
  id: string;
  title: string;
  number: number;
  season: number;
  duration?: string | null;
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
  watchPlayerConfig?: WatchPlayerConfigState | null;
  sourceType: string;
  isDirectSource: boolean;
  sources?: { label?: string; url: string; type: string }[];
};

function formatSeasonLabel(episode: EpisodeItem) {
  return `T${episode.season} · Ep ${episode.number}`;
}

function isHlsUrl(url: string) {
  if (!url) return false;
  return /(\.m3u8)(\?|#|$)/i.test(url) || /(?:^|[?&])format=m3u8(?:&|$)/i.test(url);
}

function getFullscreenElement() {
  if (typeof document === "undefined") return null;
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
}

async function setLandscapeLock(enabled: boolean) {
  if (typeof screen === "undefined") return;
  const orientation = (screen as any)?.orientation;
  if (!orientation) return;

  try {
    if (enabled && typeof orientation.lock === "function") {
      await orientation.lock("landscape");
      return;
    }
    if (!enabled && typeof orientation.unlock === "function") {
      orientation.unlock();
    }
  } catch {
    // ignore orientation lock errors
  }
}

function getUrlHost(value: string) {
  const url = String(value || "").trim();
  if (!url.startsWith("http")) return "";

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function looksDirectPlaybackUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("http")) return false;

  const normalized = raw.toLowerCase();
  if (/\.(mp4|m4v|webm|ogg|mov|m3u8|mpd|ts)(\?|#|$)/.test(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    return (
      pathname.startsWith("/api/watch/proxy") ||
      host.includes("googlevideo.com") ||
      host.includes("akamaized.net") ||
      host.includes("cloudfront.net") ||
      host.includes("bunnycdn") ||
      host.includes("storage.googleapis.com") ||
      host.includes("wasabisys.com") ||
      host.includes("backblazeb2.com") ||
      (host.includes("blogspot.com") && pathname.includes("videoplayback")) ||
      /(?:^|[?&])(format|mime)=video/.test(search) ||
      /(?:^|[?&])type=video/.test(search)
    );
  } catch {
    return false;
  }
}

const WATCH_PROXY_HOST_HINTS = [
  "blogger.com",
  "blogspot.com",
  "googlevideo.com",
  "drive.google.com",
  "drive.usercontent.google.com",
  "storage.googleapis.com",
  "akamaized.net",
  "cloudfront.net",
  "bunnycdn",
  "wasabisys.com",
  "backblazeb2.com",
];

function isProxyEligiblePlaybackUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/api/watch/proxy")) return true;
  if (!raw.startsWith("http")) return false;

  try {
    const host = new URL(raw).hostname.toLowerCase();
    return WATCH_PROXY_HOST_HINTS.some((hint) => host.includes(hint));
  } catch {
    return false;
  }
}

function buildLocalWatchProxyUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/api/watch/proxy")) return raw;
  return `/api/watch/proxy?src=${encodeURIComponent(raw)}`;
}

function toTomatoPlayableSource(url: string, type?: string) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return null;

  const normalizedType = String(type || "").toLowerCase();

  // Preserve explicit embed sources so fallback can actually switch out of direct/proxy mode.
  if (normalizedType === "embed" && normalizedUrl.startsWith("http")) {
    return { url: normalizedUrl, type: "embed" as const };
  }

  if (normalizedUrl.startsWith("/api/watch/proxy")) {
    return { url: normalizedUrl, type: "direct" as const };
  }

  if (isProxyEligiblePlaybackUrl(normalizedUrl)) {
    return { url: buildLocalWatchProxyUrl(normalizedUrl), type: "direct" as const };
  }

  if (normalizedType === "direct" || looksDirectPlaybackUrl(normalizedUrl)) {
    return { url: normalizedUrl, type: "direct" as const };
  }

  if (normalizedUrl.startsWith("http")) {
    return { url: normalizedUrl, type: "embed" as const };
  }

  return null;
}

function pickPreferredDirectSource(
  sources?: { label?: string; url: string; type: string }[] | null,
  fallbackUrl?: string | null,
  fallbackType?: string | null,
) {
  const listedSources = Array.isArray(sources)
    ? sources.filter((source) => Boolean(String(source?.url || "").trim()))
    : [];

  const prioritized = [
    ...listedSources.filter((source) => {
      const sourceType = String(source.type || "").toLowerCase();
      return sourceType === "direct" || looksDirectPlaybackUrl(source.url);
    }),
    ...listedSources,
  ];

  for (const source of prioritized) {
    const playable = toTomatoPlayableSource(source.url, source.type);
    if (playable) return playable;
  }

  const fallback = String(fallbackUrl || "").trim();
  const fallbackResolvedType = String(fallbackType || "").toLowerCase();
  const fallbackPlayable = toTomatoPlayableSource(fallback, fallbackResolvedType);
  if (fallbackPlayable) {
    return fallbackPlayable;
  }

  return null;
}

function isSourceDirectLike(source: { url: string; type: string }) {
  const sourceType = String(source.type || "").toLowerCase();
  if (sourceType === "direct") return true;
  return looksDirectPlaybackUrl(source.url);
}

function getNextTomatoSource(
  sources: { label?: string; url: string; type: string }[],
  failedKeys: Set<string>,
  failedHosts: Set<string>,
  currentSource: { url: string; type: string },
) {
  if (!sources.length) return null;

  const currentKey = `${currentSource.type}:${currentSource.url}`;
  failedKeys.add(currentKey);

  const currentHost = getUrlHost(currentSource.url);
  if (currentHost) {
    failedHosts.add(currentHost);
  }

  const available = sources.filter((source) => {
    const key = `${source.type}:${source.url}`;
    return !failedKeys.has(key);
  });
  if (!available.length) return null;

  const preferred = available.filter((source) => isSourceDirectLike(source));
  const pool = preferred.length ? preferred : available;

  const withDifferentHost = pool.filter((source) => {
    const host = getUrlHost(source.url);
    if (!host) return true;
    return !failedHosts.has(host);
  });

  return withDifferentHost.length ? withDifferentHost[0] : pool[0];
}

const HISTORY_QUEUE_KEY_BASE = "futuro-watch-history-queue-v1";

type HistoryUpdatePayload = {
  episodeId: string;
  progressSec: number;
  watched?: boolean;
};

type QueuedHistoryItem = {
  episodeId: string;
  progressSec: number;
  watched: boolean;
  updatedAt: number;
};

type WatchTelemetryEventPayload = {
  event: "source_failure" | "source_switch" | "player_fatal" | "source_manual_switch";
  animeId?: string;
  episodeId?: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceLabel?: string;
  fallbackUrl?: string;
  fallbackType?: string;
  fallbackLabel?: string;
  message?: string;
};

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
  const hlsRef = useRef<Hls | null>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const autoplayTimeout = useRef<ReturnType<typeof setInterval>>();
  const seekFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedSourcesRef = useRef<Set<string>>(new Set());
  const failedHostsRef = useRef<Set<string>>(new Set());
  const telemetryCooldownRef = useRef<Map<string, number>>(new Map());
  const mobileChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endHandledRef = useRef(false);
  const [data, setData] = useState<WatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeApplied, setResumeApplied] = useState(false);
  const [seekFlash, setSeekFlash] = useState<"back" | "forward" | null>(null);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [prefetchedNext, setPrefetchedNext] = useState(false);
  const [allowNextPrefetch, setAllowNextPrefetch] = useState(true);
  const [currentSource, setCurrentSource] = useState<{ url: string; type: string }>({ url: "", type: "direct" });
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [seasonFilter, setSeasonFilter] = useState<number | "all">("all");
  const [playerError, setPlayerError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(false);
  const [mobileImmersive, setMobileImmersive] = useState(false);
  const [autoFullscreenAttempted, setAutoFullscreenAttempted] = useState(false);
  const [showMobileChrome, setShowMobileChrome] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"none" | "details" | "episodes">("none");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugSending, setBugSending] = useState(false);
  const [bugMsg, setBugMsg] = useState<{ type: "ok" | "err"; text: string }>({ type: "ok", text: "" });
  const [bugForm, setBugForm] = useState({ title: "", description: "" });
  const pendingRestoreTimeRef = useRef<number | null>(null);
  const lastProgressSentRef = useRef(0);
  const isCurrentDirect = currentSource.type === "direct";
  const watchPlayerConfig = useMemo(
    () => normalizeWatchPlayerConfig(data?.watchPlayerConfig || WATCH_PLAYER_DEFAULT_CONFIG),
    [data?.watchPlayerConfig],
  );
  const AUTOPLAY_SECONDS = watchPlayerConfig.autoplaySeconds;
  const historyQueueKey = useMemo(() => {
    const userId = String((session?.user as any)?.id || "").trim();
    const email = String(session?.user?.email || "").trim().toLowerCase();
    return `${HISTORY_QUEUE_KEY_BASE}:${userId || email || "guest"}`;
  }, [session?.user]);
  const nextPromptWindowSec = useMemo(
    () => resolveNextPromptWindowSeconds(currentSource.type, watchPlayerConfig),
    [currentSource.type, watchPlayerConfig],
  );

  const queueHistoryUpdate = useCallback((payload: HistoryUpdatePayload) => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(historyQueueKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, QueuedHistoryItem>) : {};
      const existing = parsed[payload.episodeId];
      const nextProgress = Math.max(
        Number(existing?.progressSec || 0),
        Math.max(0, Math.floor(payload.progressSec || 0)),
      );

      parsed[payload.episodeId] = {
        episodeId: payload.episodeId,
        progressSec: nextProgress,
        watched: Boolean(existing?.watched || payload.watched),
        updatedAt: Date.now(),
      };

      localStorage.setItem(historyQueueKey, JSON.stringify(parsed));
    } catch {
      // ignore storage failures
    }
  }, [historyQueueKey]);

  const flushQueuedHistory = useCallback(async () => {
    if (typeof window === "undefined") return;

    let queue: Record<string, QueuedHistoryItem> = {};
    try {
      const raw = localStorage.getItem(historyQueueKey);
      queue = raw ? (JSON.parse(raw) as Record<string, QueuedHistoryItem>) : {};
    } catch {
      return;
    }

    const items = Object.values(queue).sort((a, b) => a.updatedAt - b.updatedAt);
    if (!items.length) return;

    const remaining: Record<string, QueuedHistoryItem> = {};

    for (const item of items) {
      try {
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: item.episodeId,
            progressSec: Math.max(0, Math.floor(item.progressSec || 0)),
            ...(item.watched ? { watched: true } : {}),
          }),
        });

        if (!res.ok) {
          remaining[item.episodeId] = item;
        }
      } catch {
        remaining[item.episodeId] = item;
      }
    }

    try {
      if (Object.keys(remaining).length > 0) {
        localStorage.setItem(historyQueueKey, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(historyQueueKey);
      }
    } catch {
      // ignore storage failures
    }
  }, [historyQueueKey]);

  const sendHistoryUpdate = useCallback(
    async (payload: HistoryUpdatePayload, options?: { keepalive?: boolean }) => {
      const progressSec = Math.max(0, Math.floor(payload.progressSec || 0));

      try {
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: payload.episodeId,
            progressSec,
            ...(payload.watched ? { watched: true } : {}),
          }),
          keepalive: Boolean(options?.keepalive),
        });

        if (!res.ok) {
          throw new Error("history update rejected");
        }
      } catch {
        queueHistoryUpdate({
          episodeId: payload.episodeId,
          progressSec,
          watched: payload.watched,
        });
      }
    },
    [queueHistoryUpdate],
  );

  const canSendTelemetry = useCallback((eventKey: string, cooldownMs = 18000) => {
    const now = Date.now();
    const previous = telemetryCooldownRef.current.get(eventKey) || 0;
    if (now - previous < cooldownMs) {
      return false;
    }

    telemetryCooldownRef.current.set(eventKey, now);
    return true;
  }, []);

  const findSourceLabel = useCallback((url?: string, type?: string) => {
    if (!data?.sources?.length || !url) return "";
    const target = toTomatoPlayableSource(url, type);

    const exact = data.sources.find((source) => source.url === url && source.type === type);
    if (exact?.label) return String(exact.label).trim();

    if (!target) return "";

    const normalized = data.sources.find((source) => {
      const playable = toTomatoPlayableSource(source.url, source.type);
      return playable?.url === target.url && playable?.type === target.type;
    });
    return String(normalized?.label || "").trim();
  }, [data?.sources]);

  const trackPlaybackEvent = useCallback((payload: WatchTelemetryEventPayload) => {
    const episodeId = String(payload.episodeId || data?.episodeId || "").trim();
    const animeId = String(payload.animeId || data?.anime?.id || "").trim();
    const sourceUrl = String(payload.sourceUrl || "").trim();
    const fallbackUrl = String(payload.fallbackUrl || "").trim();

    const eventKey = [
      payload.event,
      episodeId,
      payload.sourceType || "",
      getUrlHost(sourceUrl),
      payload.fallbackType || "",
      getUrlHost(fallbackUrl),
    ].join("|");

    if (!canSendTelemetry(eventKey)) return;

    const connection = (navigator as any)?.connection;
    const network = {
      effectiveType: String(connection?.effectiveType || "").toLowerCase() || null,
      saveData: Boolean(connection?.saveData),
      downlink: Number.isFinite(Number(connection?.downlink)) ? Number(connection.downlink) : null,
      rtt: Number.isFinite(Number(connection?.rtt)) ? Number(connection.rtt) : null,
    };

    fetch("/api/watch/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event: payload.event,
        animeId: animeId || undefined,
        episodeId: episodeId || undefined,
        sourceUrl: sourceUrl || undefined,
        sourceType: payload.sourceType || undefined,
        sourceLabel: payload.sourceLabel || findSourceLabel(sourceUrl, payload.sourceType),
        sourceHost: getUrlHost(sourceUrl) || undefined,
        fallbackUrl: fallbackUrl || undefined,
        fallbackType: payload.fallbackType || undefined,
        fallbackLabel: payload.fallbackLabel || findSourceLabel(fallbackUrl, payload.fallbackType),
        fallbackHost: getUrlHost(fallbackUrl) || undefined,
        message: payload.message || undefined,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        network,
        pageVisible: typeof document !== "undefined" ? document.visibilityState : undefined,
      }),
    }).catch(() => {});
  }, [canSendTelemetry, data?.anime?.id, data?.episodeId, findSourceLabel]);

  const revealMobileChrome = useCallback((sticky = false) => {
    setShowMobileChrome(true);
    if (!isMobileViewport) return;

    if (mobileChromeTimerRef.current) {
      clearTimeout(mobileChromeTimerRef.current);
    }

    if (!sticky) {
      mobileChromeTimerRef.current = setTimeout(() => {
        setShowMobileChrome(false);
      }, 2600);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setLoadError("");
    lastProgressSentRef.current = 0;
    pendingRestoreTimeRef.current = null;
    endHandledRef.current = false;
    failedHostsRef.current.clear();
    setResumeApplied(false);
    setAutoplayCountdown(null);
    setShowNextEpisodePrompt(false);
    setMobilePanel("none");
    setAutoFullscreenAttempted(false);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileImmersive(true);
    }
    setDetailsExpanded(false);
    clearInterval(autoplayTimeout.current);

    setPipSupported(typeof document !== "undefined" && !!(document as any).pictureInPictureEnabled);

    const loadWatchPayload = async () => {
      try {
        const response = await fetch(`/api/watch/${params.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        const validPayload = Boolean(
          response.ok &&
            payload?.anime?.id &&
            payload?.episode?.id &&
            Array.isArray(payload?.playlist),
        );

        if (!validPayload) {
          const apiError = String(payload?.error || "Esse episódio não está disponível agora.").trim();
          throw new Error(apiError || "Esse episódio não está disponível agora.");
        }

        if (cancelled) return;

        const listedSources = Array.isArray(payload?.sources)
          ? payload.sources.filter((source: { url?: string }) => Boolean(source?.url))
          : [];

        const preferredSource = pickPreferredDirectSource(
          listedSources as { label?: string; url: string; type: string }[],
          payload?.videoToPlay,
          payload?.sourceType,
        );

        setData(payload as WatchPayload);
        if (preferredSource?.url) {
          setCurrentSource(preferredSource);
          setPlayerError("");
        } else {
          setCurrentSource({ url: "", type: "direct" });
          setPlayerError("Este episódio não possui fonte disponível no momento.");
        }
        setLoading(false);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setData(null);
        setCurrentSource({ url: "", type: "direct" });
        setLoading(false);
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar o episódio.");
      }
    };

    void loadWatchPayload();

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(autoplayTimeout.current);
    };
  }, [params.id]);

  useEffect(() => {
    return () => {
      if (seekFlashTimeoutRef.current) {
        clearTimeout(seekFlashTimeoutRef.current);
      }
      if (mobileChromeTimerRef.current) {
        clearTimeout(mobileChromeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsMobileViewport(width < 768);
      setIsPortraitOrientation(height >= width);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setShowMobileChrome(true);
      setMobileImmersive(false);
      if (mobileChromeTimerRef.current) {
        clearTimeout(mobileChromeTimerRef.current);
      }
      return;
    }

    setMobileImmersive(true);
    revealMobileChrome();
  }, [isMobileViewport, revealMobileChrome]);

  useEffect(() => {
    if (autoplayCountdown !== null || playerError || showNextEpisodePrompt) {
      revealMobileChrome(true);
    }
  }, [autoplayCountdown, playerError, revealMobileChrome, showNextEpisodePrompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connection = (navigator as any)?.connection;
    if (!connection) return;

    const updatePrefetch = () => {
      const effectiveType = String(connection.effectiveType || "").toLowerCase();
      const saveData = Boolean(connection.saveData);
      const constrained =
        saveData ||
        effectiveType.includes("slow-2g") ||
        effectiveType.includes("2g") ||
        effectiveType.includes("3g");
      setAllowNextPrefetch(!constrained);
    };

    updatePrefetch();
    if (typeof connection.addEventListener === "function") {
      connection.addEventListener("change", updatePrefetch);
      return () => connection.removeEventListener("change", updatePrefetch);
    }

    return undefined;
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen as EventListener);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current as any;
    if (!video || !isCurrentDirect) return;

    const onWebkitBeginFullscreen = () => setIsFullscreen(true);
    const onWebkitEndFullscreen = () => setIsFullscreen(Boolean(getFullscreenElement()));

    video.addEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);

    return () => {
      video.removeEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen);
      video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    };
  }, [currentSource.url, isCurrentDirect]);

  useEffect(() => {
    const root = document.documentElement;
    const immersiveActive = isMobileViewport && mobileImmersive;
    const forceLandscape = immersiveActive && isPortraitOrientation;

    if (isFullscreen) {
      root.classList.add("watch-fullscreen");
    } else {
      root.classList.remove("watch-fullscreen");
    }

    if (immersiveActive) {
      root.classList.add("watch-immersive");
    } else {
      root.classList.remove("watch-immersive");
    }

    if (forceLandscape) {
      root.classList.add("watch-force-landscape");
    } else {
      root.classList.remove("watch-force-landscape");
    }

    return () => {
      root.classList.remove("watch-fullscreen");
      root.classList.remove("watch-immersive");
      root.classList.remove("watch-force-landscape");
    };
  }, [isFullscreen, isMobileViewport, isPortraitOrientation, mobileImmersive]);

  useEffect(() => {
    if (!isMobileViewport) return;
    void setLandscapeLock(isFullscreen || mobileImmersive);

    return () => {
      void setLandscapeLock(false);
    };
  }, [isFullscreen, isMobileViewport, mobileImmersive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user) return;

    try {
      const scopedQueue = localStorage.getItem(historyQueueKey);
      if (scopedQueue) return;

      const legacyQueue = localStorage.getItem(HISTORY_QUEUE_KEY_BASE);
      if (!legacyQueue) return;

      localStorage.setItem(historyQueueKey, legacyQueue);
      localStorage.removeItem(HISTORY_QUEUE_KEY_BASE);
    } catch {
      // ignore storage restrictions
    }
  }, [historyQueueKey, session?.user]);

  useEffect(() => {
    void flushQueuedHistory();

    const handleOnline = () => {
      void flushQueuedHistory();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushQueuedHistory]);

  useEffect(() => {
    if (data?.videoToPlay) {
      failedSourcesRef.current.clear();
      failedHostsRef.current.clear();
      endHandledRef.current = false;
      setPlayerError("");
      const resolvedPreferred = pickPreferredDirectSource(
        data.sources,
        data.videoToPlay,
        data.sourceType,
      );
      if (resolvedPreferred?.url) {
        setCurrentSource(resolvedPreferred);
      } else {
        setCurrentSource({ url: "", type: "direct" });
        setPlayerError("Sem fonte disponível para reproduzir este episódio.");
      }
    }
  }, [data?.videoToPlay, data?.sourceType, data?.sources]);

  // Prefetch next episode source when available and direct
  useEffect(() => {
    if (!data?.nextEpisode || prefetchedNext || !allowNextPrefetch) return;
    // Simple prefetch: create link rel=prefetch for next watch page (server will load video)
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = `/watch/${data.nextEpisode.id}`;
    document.head.appendChild(link);
    setPrefetchedNext(true);
    return () => {
      document.head.removeChild(link);
    };
  }, [allowNextPrefetch, data?.nextEpisode, prefetchedNext]);

  // ── Playback speed ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCurrentDirect || !data) return;
    const speed = parseFloat(data.viewerSettings.playbackSpeed === "Normal" ? "1" : data.viewerSettings.playbackSpeed);
    video.playbackRate = Number.isFinite(speed) ? speed : 1;
  }, [data, isCurrentDirect]);

  // ── Resume playback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCurrentDirect || !data?.history || resumeApplied) return;
    const applyResume = () => {
      if (!data.history?.progressSec) return;
      video.currentTime = data.history.progressSec;
      setResumeApplied(true);
    };
    video.addEventListener("loadedmetadata", applyResume);
    return () => video.removeEventListener("loadedmetadata", applyResume);
  }, [data, resumeApplied, isCurrentDirect]);

  // ── Save progress every 10s ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCurrentDirect || !data?.episodeId || !session?.user) return;

    void flushQueuedHistory();
    const interval = setInterval(() => {
      if (!video.paused && Number.isFinite(video.currentTime)) {
        const progressSec = Math.max(0, Math.floor(video.currentTime));
        if (progressSec <= lastProgressSentRef.current + 1) {
          return;
        }

        lastProgressSentRef.current = progressSec;
        void sendHistoryUpdate({
          episodeId: data.episodeId,
          progressSec,
          watched: video.ended,
        });
      }
    }, 10000);

    return () => {
      clearInterval(interval);

      if (Number.isFinite(video.currentTime) && video.currentTime > 0) {
        void sendHistoryUpdate(
          {
            episodeId: data.episodeId,
            progressSec: Math.floor(video.currentTime),
            watched: video.ended,
          },
          { keepalive: true },
        );
      }
    };
  }, [data?.episodeId, flushQueuedHistory, isCurrentDirect, sendHistoryUpdate, session?.user]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCurrentDirect || !data?.episodeId || !session?.user) return;

    const persistCurrentProgress = () => {
      if (!Number.isFinite(video.currentTime) || video.currentTime <= 0) return;
      const progressSec = Math.floor(video.currentTime);
      if (progressSec <= 0) return;

      if (progressSec > lastProgressSentRef.current) {
        lastProgressSentRef.current = progressSec;
      }

      void sendHistoryUpdate(
        {
          episodeId: data.episodeId,
          progressSec,
          watched: video.ended,
        },
        { keepalive: true },
      );
    };

    const tryAutoPip = () => {
      const pipEnabled = Boolean((document as any).pictureInPictureEnabled);
      const inPip = Boolean((document as any).pictureInPictureElement);
      if (!pipEnabled || inPip) return;
      if (video.paused || video.ended) return;

      (video as any).requestPictureInPicture?.().catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentProgress();
        tryAutoPip();
      }
    };

    const onPageHide = () => {
      persistCurrentProgress();
      tryAutoPip();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data?.episodeId, isCurrentDirect, sendHistoryUpdate, session?.user]);

  useEffect(() => {
    const video = videoRef.current as any;
    if (!video || !isCurrentDirect) return;

    const maybeEnterPip = () => {
      const pipEnabled = Boolean((document as any).pictureInPictureEnabled);
      const inPip = Boolean((document as any).pictureInPictureElement);
      if (!pipEnabled || inPip) return;
      if (video.paused || video.ended) return;

      video.requestPictureInPicture?.().catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        maybeEnterPip();
      }
    };

    window.addEventListener("pagehide", maybeEnterPip);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", maybeEnterPip);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data?.episodeId, isCurrentDirect]);

  // ── Keyboard shortcuts (MP4 only) ──
  useEffect(() => {
    if (!isCurrentDirect) return;
    const video = videoRef.current;
    const wrapper = playerWrapRef.current;
    if (!video) return;

    const handler = (e: KeyboardEvent) => {
      // Don't steal keys when typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (video.paused) {
            void video.play();
          } else {
            video.pause();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
          break;
        case "KeyJ":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "KeyL":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
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
          if (getFullscreenElement()) {
            if (document.exitFullscreen) {
              void document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
              void (document as any).webkitExitFullscreen();
            }
          } else {
            const wrapperAny = wrapper as any;
            if (wrapperAny?.requestFullscreen) {
              void wrapperAny.requestFullscreen();
            } else if (wrapperAny?.webkitRequestFullscreen) {
              void wrapperAny.webkitRequestFullscreen();
            } else if (wrapperAny?.msRequestFullscreen) {
              void wrapperAny.msRequestFullscreen();
            } else {
              const videoAny = video as any;
              if (videoAny?.webkitEnterFullscreen) {
                videoAny.webkitEnterFullscreen();
              }
            }
          }
          break;
        case "KeyM":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case "KeyN":
          if (data?.nextEpisode?.id) {
            e.preventDefault();
            router.push(`/watch/${data.nextEpisode.id}`);
          }
          break;
        case "KeyP":
          if (data?.prevEpisode?.id) {
            e.preventDefault();
            router.push(`/watch/${data.prevEpisode.id}`);
          }
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
  }, [data?.nextEpisode?.id, data?.prevEpisode?.id, isCurrentDirect, router]);

  const groupedEpisodes = useMemo(() => {
    if (!data?.playlist) return {} as Record<number, EpisodeItem[]>;
    return data.playlist.reduce<Record<number, EpisodeItem[]>>((groups, episode) => {
      if (!groups[episode.season]) groups[episode.season] = [];
      groups[episode.season].push(episode);
      return groups;
    }, {});
  }, [data]);

  const seasonOptions = useMemo(() => {
    return Object.keys(groupedEpisodes)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }, [groupedEpisodes]);

  const filteredEpisodeGroups = useMemo(() => {
    const q = playlistQuery.trim().toLowerCase();
    const result: Record<number, EpisodeItem[]> = {};

    for (const [seasonStr, episodes] of Object.entries(groupedEpisodes)) {
      const season = Number(seasonStr);
      if (seasonFilter !== "all" && season !== seasonFilter) continue;

      const filtered = episodes.filter((episode) => {
        if (!q) return true;
        const title = (episode.title || "").toLowerCase();
        return title.includes(q) || String(episode.number).includes(q) || String(episode.season).includes(q);
      });

      if (filtered.length) result[season] = filtered;
    }

    return result;
  }, [groupedEpisodes, playlistQuery, seasonFilter]);

  const orderedPlaylist = useMemo(() => {
    if (!data?.playlist) return [] as EpisodeItem[];
    return [...data.playlist].sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.number - b.number;
    });
  }, [data?.playlist]);

  const currentPlaylistIndex = useMemo(() => {
    if (!data?.episode?.id) return -1;
    return orderedPlaylist.findIndex((episode) => episode.id === data.episode.id);
  }, [data?.episode?.id, orderedPlaylist]);

  const prevPlaylistEpisode = currentPlaylistIndex > 0 ? orderedPlaylist[currentPlaylistIndex - 1] : null;
  const nextPlaylistEpisode =
    currentPlaylistIndex >= 0 ? orderedPlaylist[currentPlaylistIndex + 1] || null : null;

  const filteredEpisodeTotal = useMemo(() => {
    return Object.values(filteredEpisodeGroups).reduce((sum, episodes) => sum + episodes.length, 0);
  }, [filteredEpisodeGroups]);

  const playbackSources = useMemo(() => {
    const listedSources = Array.isArray(data?.sources)
      ? data.sources.filter((source) => Boolean(source?.url))
      : [];

    const prepared = listedSources
      .map((source) => {
        const playable = toTomatoPlayableSource(source.url, source.type);
        if (!playable) return null;
        return {
          label: source.label,
          url: playable.url,
          type: playable.type,
        };
      })
      .filter((source): source is { label?: string; url: string; type: string } => Boolean(source));

    const deduped = Array.from(
      new Map(prepared.map((source) => [`${source.type}:${source.url}`, source])).values(),
    );
    if (deduped.length > 0) return deduped;

    const fallback = toTomatoPlayableSource(data?.videoToPlay || "", data?.sourceType);
    if (fallback) {
      return [{ label: "Principal", url: fallback.url, type: fallback.type }];
    }

    return [] as { label?: string; url: string; type: string }[];
  }, [data?.sources, data?.videoToPlay, data?.sourceType]);

  const applySource = useCallback((next: { url: string; type: string }, preservePosition = false) => {
    if (!next.url) return;

    if (preservePosition && currentSource.type === "direct" && next.type === "direct") {
      const currentTime = videoRef.current?.currentTime;
      if (Number.isFinite(currentTime) && (currentTime || 0) > 1) {
        pendingRestoreTimeRef.current = Math.floor(currentTime as number);
      }
    } else {
      pendingRestoreTimeRef.current = null;
    }

    setPlayerError("");
    setCurrentSource({ url: next.url, type: next.type || "direct" });
  }, [currentSource.type]);

  const pickNextSource = useCallback(() => {
    return getNextTomatoSource(
      playbackSources,
      failedSourcesRef.current,
      failedHostsRef.current,
      currentSource,
    );
  }, [currentSource.type, currentSource.url, playbackSources]);

  const handleSourceFailure = useCallback((message: string) => {
    trackPlaybackEvent({
      event: "source_failure",
      sourceUrl: currentSource.url,
      sourceType: currentSource.type,
      message,
    });

    const nextSource = pickNextSource();
    if (nextSource) {
      trackPlaybackEvent({
        event: "source_switch",
        sourceUrl: currentSource.url,
        sourceType: currentSource.type,
        fallbackUrl: nextSource.url,
        fallbackType: nextSource.type,
        message: "auto-fallback",
      });
      applySource({ url: nextSource.url, type: nextSource.type }, true);
      return;
    }

    trackPlaybackEvent({
      event: "player_fatal",
      sourceUrl: currentSource.url,
      sourceType: currentSource.type,
      message,
    });
    setPlayerError(message);
  }, [applySource, currentSource.type, currentSource.url, pickNextSource, trackPlaybackEvent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCurrentDirect || !currentSource.url) return;

    setPlayerError("");

    const restorePlaybackPosition = () => {
      const restoreAt = pendingRestoreTimeRef.current;
      if (typeof restoreAt !== "number" || !Number.isFinite(restoreAt)) return;

      const duration = Number.isFinite(video.duration) ? Number(video.duration) : Infinity;
      const target = Math.max(0, Math.min(Number(restoreAt), duration > 5 ? duration - 2 : duration));
      if (Number.isFinite(target) && target > 0) {
        video.currentTime = target;
      }

      pendingRestoreTimeRef.current = null;
    };

    video.addEventListener("loadedmetadata", restorePlaybackPosition);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(currentSource.url)) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = currentSource.url;
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.loadSource(currentSource.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, errorData) => {
          if (errorData?.fatal) {
            handleSourceFailure("Não foi possível reproduzir esta fonte.");
          }
        });
      } else {
        handleSourceFailure("Seu navegador não suporta este stream.");
      }
    } else {
      video.src = currentSource.url;
    }

    return () => {
      video.removeEventListener("loadedmetadata", restorePlaybackPosition);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource.url, isCurrentDirect, handleSourceFailure]);

  const handleTimeUpdate = () => {
    if (!data?.episode || !videoRef.current) return;
    const t = videoRef.current.currentTime;

    const duration = videoRef.current.duration;
    if (
      data.nextEpisode &&
      Number.isFinite(duration) &&
      duration > 0 &&
      autoplayCountdown === null
    ) {
      const remaining = duration - t;
      setShowNextEpisodePrompt(remaining <= nextPromptWindowSec && remaining > 1);

      if (remaining <= 0.8 && !endHandledRef.current) {
        handleEnded();
      }
    } else {
      setShowNextEpisodePrompt(false);
    }
  };

  const seekBySeconds = (deltaSec: number, direction: "back" | "forward") => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const next = Math.max(0, Math.min(duration, video.currentTime + deltaSec));
    video.currentTime = next;

    setSeekFlash(direction);
    if (seekFlashTimeoutRef.current) {
      clearTimeout(seekFlashTimeoutRef.current);
    }
    seekFlashTimeoutRef.current = setTimeout(() => {
      setSeekFlash(null);
    }, 700);
  };

  const handleEnded = () => {
    if (!data?.episodeId || endHandledRef.current) return;
    endHandledRef.current = true;

    void sendHistoryUpdate({
      episodeId: data.episodeId,
      progressSec: Math.floor(videoRef.current?.duration || 0),
      watched: true,
    }, { keepalive: true });

    setShowNextEpisodePrompt(false);
    revealMobileChrome(true);

    if (!data.nextEpisode) return;
    if (!data.viewerSettings?.autoplay) {
      setAutoplayCountdown(null);
      setShowNextEpisodePrompt(true);
      return;
    }

    clearInterval(autoplayTimeout.current);
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

   const handleEnterPip = async () => {
     try {
       if (videoRef.current && (document as any).pictureInPictureEnabled) {
         if ((document as any).pictureInPictureElement) {
           await (document as any).exitPictureInPicture();
         }
         await (videoRef.current as any).requestPictureInPicture();
       }
     } catch (e) {
       console.warn("PIP error", e);
     }
   };

  const cancelAutoplay = () => {
    clearInterval(autoplayTimeout.current);
    setAutoplayCountdown(null);
    setShowNextEpisodePrompt(Boolean(data?.nextEpisode));
  };

  const openBugModal = () => {
    if (!data) return;
    setBugMsg({ type: "ok", text: "" });
    setBugForm({
      title: `Bug no player - ${formatSeasonLabel(data.episode)}`,
      description: "",
    });
    setShowBugModal(true);
  };

  const handleBugReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !data) return;

    const description = bugForm.description.trim();
    if (description.length < 8) {
      setBugMsg({ type: "err", text: "Descreva melhor o problema (mínimo 8 caracteres)." });
      return;
    }

    setBugSending(true);
    setBugMsg({ type: "ok", text: "" });

    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: data.anime.id,
          episodeId: data.episode.id,
          title: bugForm.title.trim() || `Bug no player - ${formatSeasonLabel(data.episode)}`,
          description,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          sourceUrl: currentSource.url || data.videoToPlay || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBugMsg({ type: "err", text: payload?.error || "Falha ao enviar bug." });
        return;
      }

      setBugMsg({ type: "ok", text: "Bug enviado com sucesso. Obrigado!" });
      setTimeout(() => {
        setShowBugModal(false);
        setBugForm({ title: "", description: "" });
      }, 900);
    } catch {
      setBugMsg({ type: "err", text: "Erro ao enviar bug." });
    } finally {
      setBugSending(false);
    }
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      const fullscreenElement = getFullscreenElement();
      if (fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return;
        }
        if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
          return;
        }
      } else {
        const wrapper = playerWrapRef.current as any;
        if (wrapper?.requestFullscreen) {
          await wrapper.requestFullscreen();
          return;
        }
        if (wrapper?.webkitRequestFullscreen) {
          await wrapper.webkitRequestFullscreen();
          return;
        }
        if (wrapper?.msRequestFullscreen) {
          await wrapper.msRequestFullscreen();
          return;
        }

        const video = videoRef.current as any;
        if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      }
    } catch {
      // ignore fullscreen errors
    }
  }, []);

  const openMobilePanel = useCallback((panel: "details" | "episodes") => {
    setMobileImmersive(false);
    setMobilePanel(panel);
    setShowMobileChrome(true);

    const targetId = panel === "episodes" ? "watch-playlist" : "watch-detalhes";
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const enableEpisodeOnlyMode = useCallback(() => {
    setMobilePanel("none");
    setMobileImmersive(true);
    if (!getFullscreenElement()) {
      void toggleFullscreen();
    }
  }, [toggleFullscreen]);

  useEffect(() => {
    if (!isMobileViewport || !data?.episodeId || autoFullscreenAttempted) return;

    setAutoFullscreenAttempted(true);
    const timer = window.setTimeout(() => {
      void toggleFullscreen();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoFullscreenAttempted, data?.episodeId, isMobileViewport, toggleFullscreen]);

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] bg-black/20 flex flex-col gap-4 justify-center items-center kdr-section-title-accent px-6">
          <div className="w-full max-w-3xl aspect-video rounded-3xl bg-zinc-900 animate-pulse" />
          <div className="w-full max-w-2xl h-4 rounded bg-zinc-900 animate-pulse" />
          <div className="w-full max-w-xl h-4 rounded bg-zinc-900 animate-pulse" />
          <p className="text-sm text-[var(--text-muted)]">Preparando o player...</p>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] bg-[var(--background)] flex flex-col justify-center items-center text-white px-6 text-center gap-4">
          <p className="font-black text-xl">Não foi possível abrir este episódio.</p>
          <p className="text-[var(--text-muted)] text-sm max-w-md">{loadError || "Vídeo não encontrado."}</p>
          <Link prefetch={true} href="/" className="kdr-btn-primary h-10 px-6 text-sm">
            Voltar para home
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tomatoTitle = `${data.episode.number}. ${
    String(data.episode.title || data.epTitle || `Episódio ${data.episode.number}`).trim()
  }`;
  const mobileOnlyEpisodeMode = isMobileViewport && mobileImmersive;

  return (
    <AppLayout>
      {showBugModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBugModal(false)} />
          <div className="relative glass-surface-heavy border border-white/12 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-[var(--text-primary)]" /> Reportar bug do episódio
              </h3>
              <button onClick={() => setShowBugModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBugReportSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Título</label>
                <input
                  value={bugForm.title}
                  onChange={(e) => setBugForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="kdr-input w-full rounded-lg px-3 py-2.5 text-sm"
                  placeholder="Ex: player travando no episódio"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Descrição *</label>
                <textarea
                  value={bugForm.description}
                  onChange={(e) => setBugForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="kdr-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[100px] resize-none"
                  placeholder="Descreva o problema, dispositivo e como reproduzir."
                />
              </div>

              {bugMsg.text && (
                <p className={`text-xs font-bold ${bugMsg.type === "ok" ? "text-green-400" : "text-purple-400"}`}>
                  {bugMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={bugSending}
                className="kdr-btn-primary w-full h-11 rounded-xl text-sm disabled:opacity-60"
              >
                {bugSending ? "Enviando..." : "Enviar bug"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={`min-h-screen ${mobileOnlyEpisodeMode ? "bg-black" : "bg-[var(--background)]"} relative overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none hidden md:block" style={{ background: "radial-gradient(920px 540px at 80% -12%, rgba(148,163,184,0.18), transparent 72%), radial-gradient(740px 440px at 14% 5%, rgba(203,213,225,0.14), transparent 70%)" }} />
        <div className={`${mobileOnlyEpisodeMode ? "max-w-none mx-0 px-0 py-0" : "max-w-[1620px] mx-auto px-0 lg:px-6 py-0 md:py-6 space-y-0 md:space-y-6"} relative z-10`}>
          <div className={`grid grid-cols-1 ${mobileOnlyEpisodeMode ? "gap-0" : "xl:grid-cols-[minmax(0,1fr)_340px] gap-0 md:gap-6"} items-start`}>
            <section className="space-y-0 md:space-y-4 pt-0">
            {/* ── Player ── */}
            <div
              id="watch-player"
              ref={playerWrapRef}
              className={`relative overflow-hidden bg-black ${mobileOnlyEpisodeMode ? "rounded-none border-0 shadow-none scroll-mt-0" : "rounded-none lg:rounded-[30px] border-0 lg:border lg:border-white/15 shadow-[0_24px_56px_rgba(0,0,0,0.55)] scroll-mt-28"}`}
              style={
                mobileOnlyEpisodeMode
                  ? {
                      position: "fixed",
                      inset: "0px",
                      width: "100vw",
                      height: "100dvh",
                      zIndex: 95,
                    }
                  : undefined
              }
            >
              <div
                className={mobileOnlyEpisodeMode ? "relative w-full h-full" : "aspect-video relative"}
                onTouchStart={() => revealMobileChrome()}
                onMouseMove={() => {
                  if (isMobileViewport) {
                    revealMobileChrome();
                  }
                }}
              >
                {currentSource.url ? (
                  isCurrentDirect ? (
                  <TomatoVideoPlayer
                    videoRef={videoRef}
                    poster={data.anime.bannerImage || data.anime.coverImage || ""}
                    title={tomatoTitle}
                    onBack={() => router.push(`/anime/${data.anime.id}`)}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    onLoadedData={() => setPlayerError("")}
                    onError={() => handleSourceFailure("Essa fonte falhou ao carregar o vídeo.")}
                    onSeekBackward={() => seekBySeconds(-10, "back")}
                    onSeekForward={() => seekBySeconds(10, "forward")}
                    onOpenEpisodes={() => openMobilePanel("episodes")}
                    onOpenAudioSubtitles={() => openMobilePanel("details")}
                    isMobileViewport={isMobileViewport}
                    introStartSec={data.episode.introStartSec}
                    introEndSec={data.episode.introEndSec}
                    outroStartSec={data.episode.outroStartSec}
                    outroEndSec={data.episode.outroEndSec}
                    onNextEpisode={
                      data.nextEpisode
                        ? () => router.push(`/watch/${data.nextEpisode?.id}`)
                        : undefined
                    }
                    showNextEpisodeButton={Boolean(data.nextEpisode)}
                  />
                  ) : (
                    <div className="absolute inset-0 bg-black">
                      <iframe
                        src={currentSource.url}
                        title={tomatoTitle}
                        className="w-full h-full border-0"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                      <div className="pointer-events-none absolute left-3 right-3 bottom-3 z-30 rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-[11px] text-white/85 backdrop-blur-sm">
                        Modo compatibilidade ativo para esta fonte.
                      </div>
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center px-6 text-center">
                    <p className="text-sm text-purple-200 font-bold">
                      Não encontramos fonte disponível para este episódio.
                    </p>
                  </div>
                )}

                {/* Auto-play countdown with SVG ring */}
                {autoplayCountdown !== null && data.nextEpisode && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-40">
                    <div className="max-w-sm w-full rounded-3xl bg-black/82 border border-[var(--accent-border)] p-6 text-center space-y-4 shadow-[0_22px_56px_rgba(0,0,0,0.58)]">
                      <p className="text-[var(--text-muted)] text-sm">Episódio concluído</p>
                      {/* Countdown ring */}
                      <div className="relative inline-flex items-center justify-center">
                        <CountdownRing total={AUTOPLAY_SECONDS} current={autoplayCountdown} />
                        <span className="absolute text-2xl font-black text-white">{autoplayCountdown}</span>
                      </div>
                      <h3 className="text-xl font-black text-white">{data.nextEpisode.title}</h3>
                      <p className="text-[var(--text-muted)] text-xs">Próximo episódio iniciando automaticamente...</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/watch/${data.nextEpisode?.id}`)}
                          className="kdr-btn-primary flex-1 h-12 rounded-2xl text-sm"
                        >
                          <Play size={14} className="inline mr-1" /> Assistir agora
                        </button>
                        <button
                          onClick={cancelAutoplay}
                          className="kdr-btn-secondary flex-1 h-12 rounded-2xl text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showNextEpisodePrompt && autoplayCountdown === null && data.nextEpisode && isCurrentDirect && (
                  <div className="absolute left-3 right-3 bottom-3 z-40 rounded-2xl border border-white/20 bg-black/80 backdrop-blur-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] font-black">Próximo episódio</p>
                        <p className="text-sm font-black text-white truncate">{data.nextEpisode.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setShowNextEpisodePrompt(false)}
                          className="h-9 px-3 rounded-lg border border-white/20 text-xs font-black text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition"
                        >
                          Fechar
                        </button>
                        <button
                          onClick={() => router.push(`/watch/${data.nextEpisode?.id}`)}
                          className="kdr-btn-primary h-9 min-w-[132px] px-5 rounded-lg text-xs justify-center"
                        >
                          <Play size={12} /> Assistir
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {seekFlash && isCurrentDirect && (
                  <div
                    className={`absolute inset-y-0 ${seekFlash === "back" ? "left-4" : "right-4"} flex items-center pointer-events-none z-30`}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-xs font-black text-white shadow-lg">
                      {seekFlash === "back" ? <RotateCcw size={14} /> : <RotateCw size={14} />}
                      {seekFlash === "back" ? "-10s" : "+10s"}
                    </div>
                  </div>
                )}

                {playerError && (
                  <div className="absolute left-3 right-3 bottom-3 z-40 rounded-2xl border border-purple-500/30 bg-black/80 backdrop-blur-md p-3 text-xs text-purple-200 space-y-2">
                    <p className="font-bold">{playerError}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSourceFailure(playerError)}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500 hover:text-white transition font-bold"
                      >
                        Tentar outra fonte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] font-black">Assistindo agora</p>
                <p className="text-sm font-black text-[var(--text-primary)] truncate">{data.anime.title} - {formatSeasonLabel(data.episode)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsExpanded((prev) => !prev)}
                className="h-9 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/12 text-xs font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                {detailsExpanded ? "Ocultar detalhes" : "Mostrar detalhes"}
              </button>
            </div>

            {!mobileOnlyEpisodeMode && (
            <div className="md:hidden px-3 pt-3 space-y-2.5">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--glass-bg-card)]/90 backdrop-blur-xl px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.17em] font-black text-[var(--text-muted)]">Assistindo agora</p>
                <h2 className="mt-1 text-base font-black text-[var(--text-primary)] leading-tight line-clamp-2">{data.anime.title}</h2>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]">
                    {formatSeasonLabel(data.episode)}
                  </span>
                  <button
                    type="button"
                    onClick={enableEpisodeOnlyMode}
                    className="h-8 px-3 rounded-full border border-[var(--border-default)] text-[11px] font-black text-[var(--text-primary)] bg-[var(--bg-card)]/70"
                  >
                    Só episódio
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  {nextPlaylistEpisode && (
                    <button
                      type="button"
                      onClick={() => router.push(`/watch/${nextPlaylistEpisode.id}`)}
                      className="h-8 min-w-[146px] px-5 rounded-full border border-[var(--border-default)] text-[11px] font-black text-[var(--text-primary)] bg-[var(--bg-card)]/70"
                    >
                      Próximo episódio
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/12 bg-black/55 p-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMobilePanel((prev) => (prev === "details" ? "none" : "details"))}
                  className={`flex-1 h-9 rounded-xl text-[11px] font-black transition ${
                    mobilePanel === "details"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10"
                  }`}
                >
                  Detalhes
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePanel((prev) => (prev === "episodes" ? "none" : "episodes"))}
                  className={`flex-1 h-9 rounded-xl text-[11px] font-black transition ${
                    mobilePanel === "episodes"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10"
                  }`}
                >
                  Episódios
                </button>
              </div>
            </div>
            )}

            {/* ── Info + Rating ── */}
            <div id="watch-detalhes" className={`${mobileOnlyEpisodeMode ? "hidden" : mobilePanel === "details" ? "block" : "hidden"} ${detailsExpanded ? "md:block" : "md:hidden"} bg-transparent md:glass-surface md:border md:border-white/10 rounded-none md:rounded-[30px] p-5 lg:p-6 mt-2 md:mt-0 scroll-mt-28`}>
              <div className="flex items-center gap-3 flex-wrap">
                <img src="/logo.png" alt="Futuro sem Contexto" className="w-10 h-10 rounded-2xl object-cover" />
                <div>
                  <p className="text-sm kdr-section-title-accent font-black uppercase tracking-[0.18em]">Futuro sem Contexto</p>
                  <h1 className="text-2xl lg:text-3xl font-black text-[var(--text-primary)]">{data.anime.title}</h1>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold">{formatSeasonLabel(data.episode)}</span>
                <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  Fonte: {data.episode.sourceLabel || data.sourceType.replace("_", " ")}
                </span>
                {data.nextEpisode && <span className="px-3 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--text-accent)] font-bold">Auto próximo ativo</span>}
                {pipSupported && isCurrentDirect && (
                  <button
                    onClick={handleEnterPip}
                    className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition"
                  >
                    Janela flutuante
                  </button>
                )}
                <button
                  type="button"
                  onClick={session ? openBugModal : () => router.push("/login")}
                  className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition font-semibold"
                >
                  Reportar bug
                </button>
                {playbackSources.length > 1 && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>Fonte atual:</span>
                    <select
                      className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-2 py-1 text-[var(--text-primary)]"
                      value={`${currentSource.type}:${currentSource.url}`}
                      onChange={(e) => {
                        const [selectedType, ...rest] = e.target.value.split(":");
                        const url = rest.join(":");
                        const playable = toTomatoPlayableSource(url, selectedType);
                        if (!playable) return;
                        trackPlaybackEvent({
                          event: "source_manual_switch",
                          sourceUrl: currentSource.url,
                          sourceType: currentSource.type,
                          fallbackUrl: playable.url,
                          fallbackType: playable.type,
                          message: "manual-inline",
                        });
                        failedSourcesRef.current.clear();
                        failedHostsRef.current.clear();
                        applySource(playable, true);
                      }}
                    >
                      {playbackSources.map((s, idx: number) => (
                        <option key={`${s.url}-${idx}`} value={`${s.type}:${s.url}`}>
                          {s.label || `Fonte ${idx + 1}`} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {data.history?.progressSec ? (
                    <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1">
                      <Clock3 size={14} /> Retomando de {Math.floor(data.history.progressSec / 60)}m
                    </span>
                ) : null}
              </div>

              <p className="mt-4 text-[var(--text-muted)] text-sm leading-relaxed">{data.epTitle}</p>

              {/* -- END Star Rating Block Moved to Anime Page -- */}
              {/* Keyboard shortcut hint (desktop only) */}
              {isCurrentDirect && (
                <p className="mt-3 text-[11px] text-[var(--text-muted)] hidden md:block">
                  Atalhos: <kbd className="bg-[var(--bg-card)] px-1 rounded">Espaço</kbd> pausar &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">←/→</kbd> ±5s &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">J/L</kbd> ±10s &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">F</kbd> tela cheia &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">M</kbd> mudo &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">N/P</kbd> troca ep &nbsp;
                  <kbd className="bg-[var(--bg-card)] px-1 rounded">0-9</kbd> pular %
                </p>
              )}
            </div>
          </section>

          {/* ── Playlist Sidebar ── */}
            <aside id="watch-playlist" className={`${mobileOnlyEpisodeMode ? "hidden" : mobilePanel === "episodes" ? "block" : "hidden"} md:block glass-surface border border-white/10 rounded-[24px] p-3 lg:p-5 xl:sticky xl:top-20 scroll-mt-28`}>
            <div className="mb-3 rounded-2xl border border-white/15 bg-black/25 p-3 sm:p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black">Episódio detalhes</p>
              <div className="grid grid-cols-2 gap-3 mt-3 pb-3 border-b border-white/10">
                <div>
                  <p className="text-3xl sm:text-4xl font-black leading-none text-[var(--text-primary)]">{data.episode.number}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] mt-1">Episódio</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-black leading-none text-[var(--text-secondary)]">{data.episode.season}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] mt-1">Temporada</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!prevPlaylistEpisode}
                  onClick={() => prevPlaylistEpisode && router.push(`/watch/${prevPlaylistEpisode.id}`)}
                  className="h-8 sm:h-9 rounded-xl border border-white/12 bg-white/[0.05] text-[var(--text-primary)] text-[11px] sm:text-xs font-black disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-1"><ChevronLeft size={13} /> Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={!nextPlaylistEpisode}
                  onClick={() => nextPlaylistEpisode && router.push(`/watch/${nextPlaylistEpisode.id}`)}
                  className="h-8 sm:h-9 rounded-xl border border-white/12 bg-white/[0.05] text-[var(--text-primary)] text-[11px] sm:text-xs font-black disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-1">Próximo <ChevronRight size={13} /></span>
                </button>
              </div>
              <div className="mt-3 space-y-1.5 text-[11px] text-[var(--text-muted)]">
                <p className="flex items-center justify-between gap-2"><span>Série</span><span className="text-[var(--text-primary)] font-bold truncate max-w-[140px]">{data.anime.title}</span></p>
                <p className="flex items-center justify-between gap-2"><span>Fonte</span><span className="text-[var(--text-primary)] font-bold">{data.episode.sourceLabel || data.sourceType.replace("_", " ")}</span></p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-[0.2em]">Playlist</p>
                <h2 className="text-lg font-black text-[var(--text-primary)]">{data.playlist.length} episódios</h2>
              </div>
              {currentPlaylistIndex >= 0 && (
                <span className="text-[11px] font-black text-[var(--text-secondary)] px-2.5 py-1 rounded-lg border border-white/12 bg-white/[0.04]">
                  #{currentPlaylistIndex + 1}
                </span>
              )}
            </div>

            <div className="mb-3 space-y-2 sticky top-0 z-10 bg-[var(--bg-surface)]/92 backdrop-blur-md py-1.5">
              <input
                value={playlistQuery}
                onChange={(e) => setPlaylistQuery(e.target.value)}
                placeholder="Buscar episódio..."
                className="kdr-input w-full rounded-xl px-3 py-1.5 text-[11px] sm:text-xs"
              />
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button
                  type="button"
                  onClick={() => setSeasonFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap border transition ${seasonFilter === "all" ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent-border)]" : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"}`}
                >
                  Todas
                </button>
                {seasonOptions.map((season) => (
                  <button
                    key={season}
                    type="button"
                    onClick={() => setSeasonFilter(season)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap border transition ${seasonFilter === season ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent-border)]" : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"}`}
                  >
                    T{season}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] font-bold">Mostrando {filteredEpisodeTotal} de {data.playlist.length} episódios</p>
            </div>

            <div className="space-y-3 max-h-[66vh] overflow-y-auto pr-1">
              {Object.keys(filteredEpisodeGroups).length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">Nenhum episódio encontrado para esse filtro.</p>
              )}

              {Object.entries(filteredEpisodeGroups).map(([season, episodes]) => (
                <div key={season}>
                  <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.18em] mb-2">Temporada {season}</p>
                  <div className="space-y-1">
                    {episodes.map((episode) => {
                      const active = episode.id === data.episode.id;
                      return (
                        <Link prefetch={false}
                          key={episode.id}
                          href={`/watch/${episode.id}`}
                          className={`block rounded-xl border px-2 py-1.5 transition ${
                            active
                              ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-card)]/40 hover:border-[var(--border-strong)] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-[var(--text-primary)] text-[12px] truncate">
                              Episódio {episode.number}
                            </p>
                            <span className="text-[10px] text-[var(--text-muted)]">{formatSeasonLabel(episode)}</span>
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
    </AppLayout>
  );
}
