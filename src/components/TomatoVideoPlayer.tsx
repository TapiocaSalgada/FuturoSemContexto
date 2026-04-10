"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import videojs from "video.js";
import {
  ArrowLeft,
  Cast,
  Captions,
  ChevronRight,
  Lock,
  LockOpen,
  Maximize,
  Minimize,
  Pause,
  Play,
  PictureInPicture2,
  RotateCcw,
  RotateCw,
  Gauge,
  Settings,
  SkipForward,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import screenfull from "screenfull";

function formatTime(seconds: number) {
  if (isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

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
  onOpenEpisodes?: () => void;
  onOpenAudioSubtitles?: () => void;
  isMobileViewport?: boolean;
  introStartSec?: number | null;
  introEndSec?: number | null;
  outroStartSec?: number | null;
  outroEndSec?: number | null;
};

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
  onOpenEpisodes,
  onOpenAudioSubtitles,
  isMobileViewport = false,
  introStartSec,
  introEndSec,
  outroStartSec,
  outroEndSec,
}: TomatoVideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);

  const [uiVisible, setUiVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<"fwd" | "bwd" | null>(null);
  const [controlsLocked, setControlsLocked] = useState(false);
  
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  useEffect(() => {
    const videoNode = internalVideoRef.current;
    if (!videoNode || playerRef.current) return;

    const player = videojs(videoNode, {
      controls: false,
      autoplay: true,
      preload: "metadata",
      fluid: true,
      html5: {
        vhs: {
          overrideNative: true
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false
      }
    });

    playerRef.current = player;
    if (poster) player.poster(poster);

    const updateTime = () => {
      setCurrentTime(player.currentTime());
      setDuration(player.duration() || 0);

      const buf = player.buffered();
      if (buf && buf.length > 0) {
        setBuffered(buf.end(buf.length - 1));
      }
      onTimeUpdate?.();
    };

    player.on("timeupdate", updateTime);
    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("ended", () => onEnded?.());
    player.on("loadeddata", () => {
      setDuration(player.duration() || 0);
      onLoadedData?.();
    });
    player.on("error", () => onError?.());
    player.on("volumechange", () => {
      setVolume(player.volume());
      setIsMuted(player.muted());
    });

    return () => {
      player.dispose();
      playerRef.current = null;
      videoRef.current = null;
    };
  }, [videoRef, poster]);

  useEffect(() => {
    if (!introStartSec && !introEndSec && !outroStartSec && !outroEndSec) return;
    const t = currentTime;
    if (typeof introStartSec === "number" && typeof introEndSec === "number") {
      setShowSkipIntro(t >= introStartSec && t < introEndSec);
    }
    if (typeof outroStartSec === "number" && typeof outroEndSec === "number") {
      setShowSkipOutro(t >= outroStartSec && t < outroEndSec);
    }
  }, [currentTime, introStartSec, introEndSec, outroStartSec, outroEndSec]);

  const resetUiTimeout = () => {
    if (controlsLocked) return;
    setUiVisible(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    if (isPlaying && !isDragging && !showSettings) {
      uiTimeoutRef.current = setTimeout(() => setUiVisible(false), 3000);
    }
  };

  useEffect(() => {
    resetUiTimeout();
    return () => {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [controlsLocked, isPlaying, isDragging, showSettings]);

  useEffect(() => {
    if (!controlsLocked) return;
    setShowSettings(false);
    setUiVisible(false);
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
  }, [controlsLocked]);

  useEffect(() => {
    if (screenfull.isEnabled) {
      const handleFsChange = () => {
        const isFs = screenfull.isFullscreen;
        setIsFullscreen(isFs);
        if (isFs && screen?.orientation?.lock) {
           screen.orientation.lock("landscape").catch(() => {});
        } else if (!isFs && screen?.orientation?.unlock) {
           screen.orientation.unlock();
        }
      };
      screenfull.on("change", handleFsChange);
      return () => screenfull.off("change", handleFsChange);
    }
  }, []);

  const togglePlay = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const p = playerRef.current;
    if (!p) return;
    if (p.paused()) p.play();
    else p.pause();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = playerRef.current;
    if (!p) return;
    p.muted(!p.muted());
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (screenfull.isEnabled && wrapperRef.current) {
      screenfull.toggle(wrapperRef.current);
    }
  };

  const showTapFeedback = (type: "fwd" | "bwd") => {
    setFeedback(type);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 500);
  };

  const skipForward = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const p = playerRef.current;
    if (p) p.currentTime(Math.min(p.currentTime() + 10, duration));
    showTapFeedback("fwd");
    onSeekForward?.();
  };

  const skipBackward = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const p = playerRef.current;
    if (p) p.currentTime(Math.max(p.currentTime() - 10, 0));
    showTapFeedback("bwd");
    onSeekBackward?.();
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (controlsLocked) return;

    const now = Date.now();
    let clientX = 0;
    if ("changedTouches" in e) {
      clientX = e.changedTouches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent).clientX;
    }

    if (now - lastTapRef.current.time < 300) {
      // Double tap detected
      const width = wrapperRef.current?.offsetWidth || 0;
      if (clientX > width / 2) {
        skipForward();
      } else {
        skipBackward();
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clientX };
      // Single tap: mobile toggles controls, desktop toggles play/pause
      setTimeout(() => {
        if (lastTapRef.current.time === now) {
          if (isMobileViewport) {
            setUiVisible((current) => {
              const next = !current;
              if (next) {
                resetUiTimeout();
              }
              return next;
            });
          } else {
            togglePlay();
          }
          lastTapRef.current = { time: 0, x: 0 };
        }
      }, 300);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (playerRef.current) playerRef.current.currentTime(time);
  };

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (playerRef.current) playerRef.current.playbackRate(rate);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const sequence = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = sequence.findIndex((rate) => rate === playbackRate);
    const next = sequence[(currentIndex + 1) % sequence.length];
    applyPlaybackRate(next);
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progressPercent = safeDuration > 0 ? Math.max(0, Math.min(100, (currentTime / safeDuration) * 100)) : 0;
  const bufferedPercent = safeDuration > 0 ? Math.max(0, Math.min(100, (buffered / safeDuration) * 100)) : 0;

  return (
    <div 
      ref={wrapperRef} 
      className="relative w-full h-full bg-black flex group select-none"
      onMouseMove={resetUiTimeout}
      onTouchStart={resetUiTimeout}
      onMouseLeave={() => isPlaying && setUiVisible(false)}
    >
      <div data-vjs-player className="w-full h-full absolute inset-0">
        <video ref={(n) => { internalVideoRef.current = n; videoRef.current = n; }} className="video-js vjs-default-skin w-full h-full object-contain" playsInline />
      </div>

      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={handlePointerUp}
      />

      {feedback === "bwd" && (
        <div className="absolute left-10 inset-y-0 w-1/3 flex items-center justify-start pointer-events-none z-20">
          <div className="bg-black/40 rounded-full p-4 animate-ping text-white backdrop-blur-md">
            <RotateCcw size={48} />
          </div>
        </div>
      )}
      
      {feedback === "fwd" && (
        <div className="absolute right-10 inset-y-0 w-1/3 flex items-center justify-end pointer-events-none z-20">
          <div className="bg-black/40 rounded-full p-4 animate-ping text-white backdrop-blur-md">
            <RotateCw size={48} />
          </div>
        </div>
      )}

      {controlsLocked && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setControlsLocked(false);
            setUiVisible(true);
            resetUiTimeout();
          }}
          className="absolute left-1/2 -translate-x-1/2 bottom-16 z-40 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md"
        >
          <LockOpen size={13} /> Desbloquear
        </button>
      )}

      <div className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 pointer-events-none ${controlsLocked ? "opacity-0" : uiVisible || !isPlaying ? "opacity-100" : "opacity-0"}`}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/35 via-transparent to-black/72" />

        {isMobileViewport ? (
          <>
            <div className="absolute left-2 right-2 top-1 flex items-center justify-between text-[9px] text-white/72 pointer-events-auto">
              <span className="font-medium tracking-[0.01em]">D:1KB U:1KB</span>
              <span className="font-medium tracking-[0.01em]">S1:E{episodeNumber || "--"}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setUiVisible((current) => !current);
                }}
                className="text-white/90 hover:text-white transition p-1.5 rounded-full -mr-1"
                aria-label="Opcoes do player"
              >
                <Cast size={13} />
              </button>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 top-[26px] pointer-events-none">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/12 px-3 py-[3px] text-[9px] font-semibold text-white/92 backdrop-blur-sm">
                <Cast size={10} className="mr-1" /> Video On
              </span>
            </div>

            <div className="absolute left-1 top-[44px] bottom-[86px] flex flex-col items-center justify-center gap-1.5 pointer-events-none">
              <Sun size={11} className="text-white/70" />
              <div className="relative w-[2px] h-20 rounded-full bg-white/25 overflow-hidden">
                <span className="absolute left-0 right-0 bottom-0 h-[24%] bg-white/90" />
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center justify-center gap-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={skipBackward}
                  className="relative w-11 h-11 rounded-full border border-white/28 bg-black/20 flex items-center justify-center text-white/92"
                >
                  <RotateCcw size={14} className="absolute top-[6px]" />
                  <span className="text-[11px] font-semibold leading-none">10</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-12 h-12 flex items-center justify-center text-white"
                >
                  {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={32} className="ml-0.5" fill="currentColor" />}
                </button>

                <button
                  type="button"
                  onClick={skipForward}
                  className="relative w-11 h-11 rounded-full border border-white/28 bg-black/20 flex items-center justify-center text-white/92"
                >
                  <RotateCw size={14} className="absolute top-[6px]" />
                  <span className="text-[11px] font-semibold leading-none">10</span>
                </button>
              </div>
            </div>

            <div className="absolute left-3 right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+34px)] pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 h-3 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={safeDuration || 100}
                    value={currentTime}
                    step={0.01}
                    onChange={handleSeek}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    className="absolute z-30 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="absolute w-full h-[2px] bg-white/35 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-white/40" style={{ width: `${bufferedPercent}%` }} />
                    <div className="absolute top-0 left-0 h-full bg-[var(--accent)]" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div
                    className="absolute z-20 w-3 h-3 rounded-full bg-[var(--accent)] border border-[var(--accent-border)]"
                    style={{ left: `${progressPercent}%`, transform: "translate(-50%, 0)" }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-white/82 tabular-nums min-w-[86px] text-right">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  {showNextEpisodeButton && onNextEpisode && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNextEpisode();
                      }}
                      className="h-6 px-1.5 rounded-md border border-white/15 bg-black/20 inline-flex items-center justify-center gap-1 text-[9px] font-semibold text-white/90"
                      title="Proximo Episodio"
                    >
                      <SkipForward size={10} /> Proximo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="absolute left-2 right-2 bottom-[calc(env(safe-area-inset-bottom,0px)+4px)] pointer-events-auto">
              <div className="grid grid-cols-5 gap-1.5 text-[9px] text-white/84">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="h-7 rounded-md border border-white/10 bg-black/20 inline-flex items-center justify-center"
                  aria-label="Tela cheia"
                >
                  <PictureInPicture2 size={13} />
                </button>

                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="h-7 rounded-md border border-white/10 bg-black/20 px-1 inline-flex items-center justify-center gap-1 font-medium whitespace-nowrap"
                >
                  <Gauge size={11} /> Speed ({playbackRate}x)
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setControlsLocked((current) => !current);
                  }}
                  className="h-7 rounded-md border border-white/10 bg-black/20 px-1 inline-flex items-center justify-center gap-1 font-medium whitespace-nowrap"
                >
                  <Lock size={11} /> Lock
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenEpisodes?.();
                  }}
                  className="h-7 rounded-md border border-white/10 bg-black/20 px-1 inline-flex items-center justify-center font-medium whitespace-nowrap"
                >
                  Episodes
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenAudioSubtitles?.();
                  }}
                  className="h-7 rounded-md border border-white/10 bg-black/20 px-1 inline-flex items-center justify-center gap-1 font-medium whitespace-nowrap"
                >
                  <Captions size={11} /> Audio & Subs
                </button>

              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-full h-24 bg-gradient-to-b from-black/80 to-transparent flex items-start px-3 sm:px-6 py-3.5 pointer-events-auto">
              <button onClick={(e)=>{e.stopPropagation(); onBack?.()}} className="text-white hover:text-[var(--accent)] transition p-2 -ml-1 rounded-full z-30">
                <ArrowLeft size={24} />
              </button>
              <div className="ml-3 mt-1 z-30 flex-1 truncate pr-4">
                <h1 className="text-white font-bold text-sm sm:text-lg drop-shadow-md truncate">{title || "Assistindo"}</h1>
                {episodeNumber && <p className="text-white/70 text-xs sm:text-sm drop-shadow-md">Episodio {episodeNumber}</p>}
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {!isPlaying && uiVisible && (
                <div className="w-20 h-20 bg-black/40 backdrop-blur border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl pointer-events-auto cursor-pointer" onClick={togglePlay}>
                  <Play size={36} className="ml-2" fill="currentColor" />
                </div>
              )}
            </div>

            <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 sm:px-6 pb-3 sm:pb-6 pt-14 sm:pt-16 pointer-events-auto">
              <div className="relative w-full h-2 group cursor-pointer flex items-center mb-3 sm:mb-4">
                <input
                  type="range"
                  min={0}
                  max={safeDuration || 100}
                  value={currentTime}
                  step={0.01}
                  onChange={handleSeek}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={() => setIsDragging(false)}
                  className="absolute z-30 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="absolute w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover:h-2">
                  <div className="absolute top-0 left-0 h-full bg-white/40" style={{ width: `${bufferedPercent}%` }} />
                  <div className="absolute top-0 left-0 h-full bg-[var(--accent)]" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="absolute h-4 w-4 bg-[var(--accent)] rounded-full -ml-2 shadow-lg scale-0 group-hover:scale-100 transition-transform" style={{ left: `${progressPercent}%` }} />
              </div>

              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="hover:scale-110 transition p-1 text-white">
                    {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
                  </button>
                  <button onClick={skipBackward} className="hover:scale-110 transition text-white/90 p-1">
                    <RotateCcw size={22} />
                  </button>
                  <button onClick={skipForward} className="hover:scale-110 transition text-white/90 p-1">
                    <RotateCw size={22} />
                  </button>

                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={toggleMute} className="hover:scale-110 transition p-1 text-white">
                      {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        if (playerRef.current) playerRef.current.volume(val);
                      }}
                      className="w-0 group-hover/vol:w-20 transition-all opacity-0 group-hover/vol:opacity-100 duration-300 accent-white h-1 bg-white/30 rounded-full appearance-none"
                    />
                  </div>

                  <div className="text-sm font-medium tabular-nums ml-2 opacity-90 drop-shadow-md">
                    {formatTime(currentTime)} <span className="opacity-50 mx-1">/</span> {formatTime(duration)}
                  </div>
                  {showNextEpisodeButton && onNextEpisode && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onNextEpisode();
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-white/95 hover:text-white transition ml-1"
                      title="Proximo Episodio"
                    >
                      <SkipForward size={19} /> Proximo
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-6">

                  <div className="relative">
                    <button onClick={(e)=>{e.stopPropagation(); setShowSettings(!showSettings)}} className="hover:scale-110 transition p-1 text-white">
                      <Settings size={22} />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-[100%] right-0 mb-4 bg-black/80 backdrop-blur-xl rounded-xl p-3 border border-white/10 min-w-[140px] z-50">
                        <p className="text-[10px] uppercase text-white/50 mb-2 font-bold px-2">Velocidade</p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => {
                              applyPlaybackRate(rate);
                              setShowSettings(false);
                            }}
                            className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition ${playbackRate === rate ? "bg-white/20 text-white font-bold" : "text-white/80 hover:bg-white/10"}`}
                          >
                            {rate}x {rate === 1 && "(Normal)"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={toggleFullscreen} className="hover:scale-110 transition p-1 text-white">
                    {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        
        {showSkipIntro && (
          <button onClick={(e) => { e.stopPropagation(); playerRef.current?.currentTime(introEndSec); }} className="absolute bottom-24 sm:bottom-28 right-3 sm:right-8 bg-white hover:bg-gray-200 text-black font-extrabold text-xs sm:text-sm px-3.5 sm:px-6 py-2 sm:py-3 rounded shadow-2xl transition-all hover:scale-105 pointer-events-auto">
            Pular Abertura
          </button>
        )}
        {showSkipOutro && !showSkipIntro && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNextEpisode) {
                onNextEpisode();
                return;
              }

              if (typeof outroEndSec === "number") {
                playerRef.current?.currentTime(outroEndSec);
              }
            }}
            className="absolute bottom-24 sm:bottom-28 right-3 sm:right-8 bg-white hover:bg-gray-200 text-black font-extrabold text-xs sm:text-sm px-3.5 sm:px-6 py-2 sm:py-3 rounded shadow-2xl transition-all hover:scale-105 pointer-events-auto"
          >
            Proximo Episodio
          </button>
        )}
      </div>
    </div>
  );
}
