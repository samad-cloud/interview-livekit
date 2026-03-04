'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  Gauge,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];
const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [jumpToInput, setJumpToInput] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    } else {
      resetControlsTimer();
    }
  }, [isPlaying, resetControlsTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) video.play(); else video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => {
            const nv = Math.min(1, v + 0.1);
            if (video) video.volume = nv;
            return nv;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => {
            const nv = Math.max(0, v - 0.1);
            if (video) video.volume = nv;
            return nv;
          });
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case ',':
          if (e.shiftKey) cycleSpeed(-1);
          break;
        case '.':
          if (e.shiftKey) cycleSpeed(1);
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [playbackSpeed, duration]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play(); else video.pause();
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    resetControlsTimer();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = parseFloat(e.target.value);
    video.volume = v;
    setVolume(v);
    if (v === 0) { video.muted = true; setIsMuted(true); }
    else if (isMuted) { video.muted = false; setIsMuted(false); }
  };

  const setSpeed = (speed: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const cycleSpeed = (direction: number) => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const next = idx + direction;
    if (next >= 0 && next < PLAYBACK_SPEEDS.length) {
      setSpeed(PLAYBACK_SPEEDS[next]);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  };

  // Progress bar seeking
  const seekFromEvent = (clientX: number) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar || !duration || !isFinite(duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    seekFromEvent(e.clientX);

    const onMouseMove = (ev: MouseEvent) => seekFromEvent(ev.clientX);
    const onMouseUp = () => {
      setIsSeeking(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverX(e.clientX - rect.left);
  };

  // Jump to timestamp
  const handleJumpTo = () => {
    const video = videoRef.current;
    if (!video || !jumpToInput.trim()) return;

    const parts = jumpToInput.trim().split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];

    if (!isNaN(seconds) && seconds >= 0 && seconds <= duration) {
      video.currentTime = seconds;
      setCurrentTime(seconds);
    }
    setShowJumpInput(false);
    setJumpToInput('');
  };

  // Download video
  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title ? `${title}.webm` : 'interview-recording.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  // Native video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isSeeking) return;
    setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isFinite(video.duration)) {
      setDuration(video.duration);
    } else {
      // WebM files recorded with MediaRecorder don't store duration in the header.
      // Seeking to an absurdly large value forces the browser to scan to the real end
      // and fire a durationchange event with the actual duration, then we reset.
      video.currentTime = 1e101;
    }
  };

  const handleDurationChange = () => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    setDuration(video.duration);
    // If we triggered the probe seek, reset playhead to the beginning
    if (video.currentTime > 0 && currentTime === 0) {
      video.currentTime = 0;
    }
  };

  const handleProgress = () => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    setBuffered(video.buffered.end(video.buffered.length - 1));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative group rounded-lg overflow-hidden bg-black select-none',
        isFullscreen ? 'w-screen h-screen' : 'w-full',
        className
      )}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      tabIndex={0}
    >
      {/* Native video element */}
      <div
        className={cn('w-full', isFullscreen ? 'h-full' : 'aspect-video max-h-[480px]')}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          className="w-full h-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleDurationChange}
          onProgress={handleProgress}
        />
      </div>

      {/* Title overlay */}
      {title && showControls && (
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <p className="text-white text-sm font-medium">{title}</p>
        </div>
      )}

      {/* Big play button when paused */}
      {!isPlaying && !isSeeking && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-black ml-1" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 transition-opacity duration-300',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-6 cursor-pointer flex items-end px-3 group/progress"
          onMouseDown={handleProgressMouseDown}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Hover tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-8 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
              style={{ left: hoverX }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Track */}
          <div className="w-full h-1 group-hover/progress:h-2 transition-all bg-white/20 rounded-full overflow-hidden relative">
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${bufferProgress}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 bg-pink-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Seek thumb */}
          <div
            className="absolute w-3.5 h-3.5 bg-pink-500 rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity -translate-x-1/2 pointer-events-none"
            style={{ left: `calc(12px + ${progress}% * (100% - 24px) / 100%)`, bottom: '4px' }}
          />
        </div>

        {/* Bottom controls bar */}
        <div className="flex items-center gap-1 px-3 pb-2 pt-0.5 bg-gradient-to-t from-black/80 to-transparent">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="p-1.5 text-white hover:text-pink-400 transition-colors" title={isPlaying ? 'Pause (k)' : 'Play (k)'}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Skip back */}
          <button onClick={() => skip(-SKIP_SECONDS)} className="p-1.5 text-white hover:text-pink-400 transition-colors" title={`Back ${SKIP_SECONDS}s`}>
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Skip forward */}
          <button onClick={() => skip(SKIP_SECONDS)} className="p-1.5 text-white hover:text-pink-400 transition-colors" title={`Forward ${SKIP_SECONDS}s`}>
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <button onClick={toggleMute} className="p-1.5 text-white hover:text-pink-400 transition-colors" title="Mute (m)">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-pink-500 h-1 cursor-pointer"
            />
          </div>

          {/* Time display / Jump to timestamp */}
          <div className="flex items-center text-white text-xs ml-2">
            {showJumpInput ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleJumpTo(); }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  value={jumpToInput}
                  onChange={(e) => setJumpToInput(e.target.value)}
                  placeholder="0:00"
                  className="w-14 bg-white/20 border border-white/30 rounded px-1.5 py-0.5 text-xs text-white placeholder:text-white/50 outline-none focus:border-pink-500"
                  autoFocus
                  onBlur={() => { setShowJumpInput(false); setJumpToInput(''); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowJumpInput(false); setJumpToInput(''); } }}
                />
              </form>
            ) : (
              <button
                onClick={() => setShowJumpInput(true)}
                className="hover:text-pink-400 transition-colors tabular-nums"
                title="Click to jump to timestamp"
              >
                {formatTime(currentTime)} / {duration && isFinite(duration) ? formatTime(duration) : '--:--'}
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Playback speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                playbackSpeed !== 1 ? 'text-pink-400 bg-pink-500/20' : 'text-white hover:text-pink-400'
              )}
              title="Playback speed (Shift+< / Shift+>)"
            >
              <Gauge className="w-3.5 h-3.5" />
              {playbackSpeed}x
            </button>

            {showSpeedMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                <div className="absolute bottom-full right-0 mb-2 bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl py-1 z-50 min-w-[100px]">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSpeed(speed)}
                      className={cn(
                        'w-full px-3 py-1.5 text-xs text-left transition-colors',
                        speed === playbackSpeed
                          ? 'text-pink-400 bg-pink-500/20'
                          : 'text-white hover:bg-white/10'
                      )}
                    >
                      {speed}x {speed === 1 && '(Normal)'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="p-1.5 text-white hover:text-pink-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
            title="Download recording"
          >
            <Download className={cn('w-4 h-4', isDownloading && 'animate-pulse')} />
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="p-1.5 text-white hover:text-pink-400 transition-colors" title="Fullscreen (f)">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
