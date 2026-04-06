"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import videojs from "video.js";
import { ArrowLeft, ChevronRight, Pause, Play, SkipForward, Maximize, Minimize, Volume2, VolumeX, Settings, RotateCcw, RotateCw } from "lucide-react";
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
  }, [isPlaying, isDragging, showSettings]);

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
      // Normal single click: toggle play/pause after verifying it's not a double click
      setTimeout(() => {
        if (lastTapRef.current.time === now) {
          togglePlay();
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

  return (
    <div 
      ref={wrapperRef} 
      className="relative w-full h-full bg-black flex group select-none touch-none"
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

      <div className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 pointer-events-none ${uiVisible || !isPlaying ? "opacity-100" : "opacity-0"}`}>
        
        <div className="w-full h-24 bg-gradient-to-b from-black/80 to-transparent flex items-start px-4 sm:px-6 py-4 pointer-events-auto">
          <button onClick={(e)=>{e.stopPropagation(); onBack?.()}} className="text-white hover:text-[var(--accent)] transition p-2 -ml-2 rounded-full z-30">
            <ArrowLeft size={24} />
          </button>
          <div className="ml-4 mt-1 z-30 flex-1 truncate pr-4">
            <h1 className="text-white font-bold text-base sm:text-lg drop-shadow-md truncate">{title || "Assistindo"}</h1>
            {episodeNumber && <p className="text-white/70 text-xs sm:text-sm drop-shadow-md">Episódio {episodeNumber}</p>}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying && uiVisible && (
            <div className="w-20 h-20 bg-black/40 backdrop-blur border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl pointer-events-auto cursor-pointer" onClick={togglePlay}>
              <Play size={36} className="ml-2" fill="currentColor" />
            </div>
          )}
        </div>

        <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 sm:px-6 pb-4 sm:pb-6 pt-16 pointer-events-auto">
          
          <div className="relative w-full h-2 group cursor-pointer flex items-center mb-4">
            <input 
              type="range" 
              min={0} 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              className="absolute z-30 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="absolute w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover:h-2">
              <div className="absolute top-0 left-0 h-full bg-white/40" style={{ width: `${(buffered / duration) * 100}%` }} />
              <div className="absolute top-0 left-0 h-full bg-[var(--accent)]" style={{ width: `${(currentTime / duration) * 100}%` }} />
            </div>
            <div className="absolute h-3 w-3 sm:h-4 sm:w-4 bg-[var(--accent)] rounded-full -ml-1.5 sm:-ml-2 shadow-lg scale-0 group-hover:scale-100 transition-transform" style={{ left: `${(currentTime / duration) * 100}%` }} />
          </div>

          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4 sm:gap-6">
              <button onClick={togglePlay} className="hover:scale-110 transition p-1 text-white">
                {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </button>
              
              <button onClick={skipBackward} className="hover:scale-110 transition text-white/90 p-1 hidden sm:block">
                <RotateCcw size={22} />
              </button>
              
              <button onClick={skipForward} className="hover:scale-110 transition text-white/90 p-1 hidden sm:block">
                <RotateCw size={22} />
              </button>

              <div className="flex items-center gap-2 group/vol hidden sm:flex">
                <button onClick={toggleMute} className="hover:scale-110 transition p-1 text-white">
                  {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>
                <input 
                  type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (playerRef.current) playerRef.current.volume(val);
                  }}
                  className="w-0 group-hover/vol:w-20 transition-all opacity-0 group-hover/vol:opacity-100 duration-300 accent-white h-1 bg-white/30 rounded-full appearance-none"
                />
              </div>
              
              <div className="text-xs sm:text-sm font-medium tabular-nums ml-2 opacity-90 drop-shadow-md">
                {formatTime(currentTime)} <span className="opacity-50 mx-1">/</span> {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              {showNextEpisodeButton && onNextEpisode && (
                <button onClick={(e)=>{e.stopPropagation(); onNextEpisode()}} className="hover:scale-110 transition p-1 hidden md:flex items-center gap-1.5 font-bold text-sm" title="Próximo Episódio">
                  <SkipForward size={22} fill="currentColor" />
                </button>
              )}

              <div className="relative">
                <button onClick={(e)=>{e.stopPropagation(); setShowSettings(!showSettings)}} className="hover:scale-110 transition p-1 text-white">
                  <Settings size={22} />
                </button>
                {showSettings && (
                  <div className="absolute bottom-[100%] right-0 mb-4 bg-black/80 backdrop-blur-xl rounded-xl p-3 border border-white/10 min-w-[140px] z-50">
                    <p className="text-[10px] uppercase text-white/50 mb-2 font-bold px-2">Velocidade</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button key={rate} onClick={() => {
                        setPlaybackRate(rate);
                        if (playerRef.current) playerRef.current.playbackRate(rate);
                        setShowSettings(false);
                      }} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition ${playbackRate === rate ? "bg-white/20 text-white font-bold" : "text-white/80 hover:bg-white/10"}`}>
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
        
        {showSkipIntro && (
          <button onClick={(e) => { e.stopPropagation(); playerRef.current?.currentTime(introEndSec); }} className="absolute bottom-28 sm:bottom-28 right-4 sm:right-8 bg-white hover:bg-gray-200 text-black font-extrabold text-sm px-6 py-3 rounded shadow-2xl transition-all hover:scale-105 pointer-events-auto">
            Pular Abertura
          </button>
        )}
        {showSkipOutro && !showSkipIntro && (
          <button onClick={(e) => { e.stopPropagation(); onNextEpisode ? onNextEpisode() : playerRef.current?.currentTime(outroEndSec); }} className="absolute bottom-28 sm:bottom-28 right-4 sm:right-8 bg-white hover:bg-gray-200 text-black font-extrabold text-sm px-6 py-3 rounded shadow-2xl transition-all hover:scale-105 pointer-events-auto">
            Próximo Episódio
          </button>
        )}
      </div>
    </div>
  );
}
