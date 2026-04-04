"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import videojs from "video.js";
import { ArrowLeft, ChevronRight, Pause, Play, SkipForward } from "lucide-react";

type TomatoVideoPlayerProps = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  poster?: string;
  title?: string;
  episodeNumber?: number;
  onBack?: () => void;
  onTimeUpdate?: () => void;
  onEnded?: () => void;
  onLoadedData?: () => void;
  onError?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onNextEpisode?: () => void;
  showNextEpisodeButton?: boolean;
  introStartSec?: number | null;
  introEndSec?: number | null;
  outroStartSec?: number | null;
  outroEndSec?: number | null;
};

function isControlClick(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      ".vjs-control-bar, .vjs-control, .vjs-menu, .vjs-modal-dialog, .vjs-big-play-button, .tomato-player__next-episode, .tomato-player__skip-intro, .tomato-player__back",
    ),
  );
}

export default function TomatoVideoPlayer({
  videoRef,
  poster,
  title,
  episodeNumber,
  onBack,
  onTimeUpdate,
  onEnded,
  onLoadedData,
  onError,
  onSeekBackward,
  onSeekForward,
  onNextEpisode,
  showNextEpisodeButton = false,
  introStartSec,
  introEndSec,
  outroStartSec,
  outroEndSec,
}: TomatoVideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAtRef = useRef(0);
  const ignoreClickUntilRef = useRef(0);
  const callbacksRef = useRef({
    onTimeUpdate,
    onEnded,
    onLoadedData,
    onError,
    onSeekBackward,
    onSeekForward,
  });
  const [feedback, setFeedback] = useState<"play" | "pause" | "fwd" | "bwd" | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(true);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const showTapFeedback = (state: "play" | "pause" | "fwd" | "bwd") => {
    setFeedback(state);
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 480);
  };

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.paused()) {
      void player.play().catch(() => {});
      showTapFeedback("play");
    } else {
      player.pause();
      showTapFeedback("pause");
    }
  };

  const setVideoNode = (node: HTMLVideoElement | null) => {
    internalVideoRef.current = node;
    videoRef.current = node;
  };

  // Skip intro/outro time tracking
  useEffect(() => {
    if (!introStartSec && !introEndSec && !outroStartSec && !outroEndSec) return;

    const checkSkip = () => {
      const t = currentTime;
      if (typeof introStartSec === "number" && typeof introEndSec === "number") {
        setShowSkipIntro(t >= introStartSec && t < introEndSec);
      }
      if (typeof outroStartSec === "number" && typeof outroEndSec === "number") {
        setShowSkipOutro(t >= outroStartSec && t < outroEndSec);
      }
    };
    checkSkip();
  }, [currentTime, introStartSec, introEndSec, outroStartSec, outroEndSec]);

  const handleSkipIntro = () => {
    const player = playerRef.current;
    if (player && typeof introEndSec === "number") {
      player.currentTime(introEndSec);
      setShowSkipIntro(false);
    }
  };

  const handleSkipOutro = () => {
    if (onNextEpisode) {
      onNextEpisode();
    } else {
      const player = playerRef.current;
      if (player && typeof outroEndSec === "number") {
        player.currentTime(outroEndSec);
        setShowSkipOutro(false);
      }
    }
  };

  useEffect(() => {
    callbacksRef.current = {
      onTimeUpdate,
      onEnded,
      onLoadedData,
      onError,
      onSeekBackward,
      onSeekForward,
    };
  }, [onEnded, onError, onLoadedData, onSeekBackward, onSeekForward, onTimeUpdate]);

  const showUiActions = uiVisible || isPaused;

  useEffect(() => {
    const videoNode = internalVideoRef.current;
    if (!videoNode || playerRef.current) return;

    const player = videojs(videoNode, {
      controls: true,
      autoplay: true,
      preload: "metadata",
      bigPlayButton: false,
      fluid: true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        remainingTimeDisplay: false,
        volumePanel: false,
        pictureInPictureToggle: true,
      },
      inactivityTimeout: 2500,
      userActions: {
        click: false,
        doubleClick: false,
      },
    });

    playerRef.current = player;

    if (poster) {
      player.poster(poster);
    }

    const onUserActive = () => setUiVisible(true);
    const onUserInactive = () => setUiVisible(false);
    const onPause = () => setIsPaused(true);
    const onPlay = () => setIsPaused(false);

    player.on("useractive", onUserActive);
    player.on("userinactive", onUserInactive);
    player.on("pause", onPause);
    player.on("play", onPlay);
    setIsPaused(player.paused());

    const handleDoubleAction = (clientX: number, width: number) => {
      if (clientX > width / 2) {
        showTapFeedback("fwd");
        callbacksRef.current.onSeekForward?.();
      } else {
        showTapFeedback("bwd");
        callbacksRef.current.onSeekBackward?.();
      }
    };

    const root = player.el();
    if (root) {
      const handleClick = (event: MouseEvent) => {
        if (Date.now() < ignoreClickUntilRef.current) return;
        if (isControlClick(event.target)) return;

        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
        }

        singleTapTimeoutRef.current = setTimeout(() => {
          togglePlayback();
        }, 220);
      };

      const handleDblClick = (event: MouseEvent) => {
        if (isControlClick(event.target)) return;

        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }

        const rect = root.getBoundingClientRect();
        handleDoubleAction(event.clientX - rect.left, rect.width);
      };

      const handleTouchEnd = (event: TouchEvent) => {
        if (isControlClick(event.target)) return;
        const touch = event.changedTouches?.[0];
        if (!touch) return;

        ignoreClickUntilRef.current = Date.now() + 320;
        const now = Date.now();
        const isDoubleTap = now - lastTapAtRef.current <= 280;

        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
        }

        if (isDoubleTap) {
          lastTapAtRef.current = 0;
          const rect = root.getBoundingClientRect();
          handleDoubleAction(touch.clientX - rect.left, rect.width);
        } else {
          lastTapAtRef.current = now;
          singleTapTimeoutRef.current = setTimeout(() => {
            togglePlayback();
          }, 220);
        }
      };

      root.addEventListener("click", handleClick as EventListener);
      root.addEventListener("dblclick", handleDblClick as EventListener);
      root.addEventListener("touchend", handleTouchEnd as EventListener, { passive: true });

      return () => {
        root.removeEventListener("click", handleClick as EventListener);
        root.removeEventListener("dblclick", handleDblClick as EventListener);
        root.removeEventListener("touchend", handleTouchEnd as EventListener);
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
        }
        if (feedbackTimeoutRef.current) {
          clearTimeout(feedbackTimeoutRef.current);
        }
        if (playerRef.current) {
          playerRef.current.off("useractive", onUserActive);
          playerRef.current.off("userinactive", onUserInactive);
          playerRef.current.off("pause", onPause);
          playerRef.current.off("play", onPlay);
          playerRef.current.dispose();
          playerRef.current = null;
        }
        videoRef.current = null;
      };
    }

    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (playerRef.current) {
        playerRef.current.off("useractive", onUserActive);
        playerRef.current.off("userinactive", onUserInactive);
        playerRef.current.off("pause", onPause);
        playerRef.current.off("play", onPlay);
        playerRef.current.dispose();
        playerRef.current = null;
      }
      videoRef.current = null;
    };
  }, [videoRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.poster(poster || "");
  }, [poster]);

  useEffect(() => {
    const videoNode = internalVideoRef.current;
    if (!videoNode) return;

    const handleTime = () => {
      setCurrentTime(videoNode.currentTime || 0);
      callbacksRef.current.onTimeUpdate?.();
    };
    const handleEnd = () => callbacksRef.current.onEnded?.();
    const handleLoaded = () => callbacksRef.current.onLoadedData?.();
    const handleErr = () => callbacksRef.current.onError?.();

    videoNode.addEventListener("timeupdate", handleTime);
    videoNode.addEventListener("ended", handleEnd);
    videoNode.addEventListener("loadeddata", handleLoaded);
    videoNode.addEventListener("error", handleErr);

    return () => {
      videoNode.removeEventListener("timeupdate", handleTime);
      videoNode.removeEventListener("ended", handleEnd);
      videoNode.removeEventListener("loadeddata", handleLoaded);
      videoNode.removeEventListener("error", handleErr);
    };
  }, []);

  const displayTitle = title
    ? episodeNumber
      ? `${episodeNumber}. ${title}`
      : title
    : "";

  return (
    <div className="tomato-player">
      <div data-vjs-player className="tomato-player__frame">
        <video
          ref={setVideoNode}
          className="video-js vjs-default-skin vjs-big-play-centered"
          playsInline
          preload="metadata"
        />
      </div>

      {/* Top bar with back + title */}
      {(onBack || displayTitle) && (
        <div className={`tomato-player__topbar ${showUiActions ? "is-visible" : "is-hidden"}`}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="tomato-player__back"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <span className="tomato-player__top-spacer" />
          )}
          <p className="tomato-player__title">{displayTitle}</p>
          <span className="tomato-player__top-spacer" />
        </div>
      )}

      {/* Skip Intro */}
      {showSkipIntro && (
        <button
          type="button"
          onClick={handleSkipIntro}
          className={`tomato-player__skip-intro ${showUiActions ? "is-visible" : "is-visible"}`}
        >
          <SkipForward size={14} /> Pular Abertura
        </button>
      )}

      {/* Skip Outro */}
      {showSkipOutro && !showSkipIntro && (
        <button
          type="button"
          onClick={handleSkipOutro}
          className={`tomato-player__skip-intro ${showUiActions ? "is-visible" : "is-visible"}`}
          style={{ bottom: showNextEpisodeButton ? "6.5rem" : undefined }}
        >
          <SkipForward size={14} /> Pular Encerramento
        </button>
      )}

      {/* Next Episode */}
      {showNextEpisodeButton && onNextEpisode && (
        <button
          type="button"
          onClick={onNextEpisode}
          className={`tomato-player__next-episode ${showUiActions ? "is-visible" : "is-hidden"}`}
        >
          Próximo episódio <ChevronRight size={16} />
        </button>
      )}

      {/* Tap feedback */}
      {feedback && (
        <div className="tomato-player__tap-feedback" aria-hidden="true">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            {feedback === "pause" && <Pause size={32} />}
            {feedback === "play" && <Play size={32} className="ml-1" />}
            {feedback === "fwd" && (
              <div className="flex items-center gap-0.5">
                <ChevronRight size={24} />
                <ChevronRight size={24} className="-ml-3" />
              </div>
            )}
            {feedback === "bwd" && (
              <div className="flex items-center gap-0.5 rotate-180">
                <ChevronRight size={24} />
                <ChevronRight size={24} className="-ml-3" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
