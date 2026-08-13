'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Mic,
  Loader2,
  RotateCcw,
  AlertCircle,
  User,
  Sparkles,
} from 'lucide-react';
import axios from 'axios';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface PodcastScriptLine {
  speaker: 'Host' | 'Expert' | string;
  line: string;
}

interface PodcastPlayerProps {
  topicId: string;
  script: PodcastScriptLine[];
  audioUrl?: string; // the database might already have a cached URL
}

/** "1:04" style mm:ss formatter. */
const fmtTime = (secs: number): string => {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ topicId, script, audioUrl }) => {
  const { token } = useWorkspaceStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Set once the user has requested playback so we can autoplay as soon as the
  // element is buffered enough (`canplay`) — far more reliable than a timeout.
  const wantsAutoPlayRef = useRef(false);

  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(audioUrl || null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // When the topic or a cached URL changes (a new podcast was generated),
  // reset the player so we don't keep playing the previous episode.
  useEffect(() => {
    setActiveAudioUrl(audioUrl || null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError('');
    wantsAutoPlayRef.current = false;
  }, [topicId, audioUrl]);

  // Ask the backend to synthesise the two-voice audio, then autoplay it.
  const generateAndPlay = useCallback(async () => {
    setIsLoadingAudio(true);
    setError('');
    try {
      const res = await axios.post(
        '/api/tts/podcast',
        { topicId, script },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success && res.data.audioUrl) {
        wantsAutoPlayRef.current = true;
        setActiveAudioUrl(res.data.audioUrl);
      } else {
        setError('Could not generate the podcast audio. Please try again.');
      }
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && e.response?.data?.error
          ? e.response.data.error
          : 'Failed to generate podcast audio. Please try again.';
      setError(msg);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [topicId, script, token]);

  const handlePlayPause = () => {
    setError('');
    // No audio yet → generate it (first click).
    if (!activeAudioUrl) {
      generateAndPlay();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setError('Playback was blocked by the browser — tap play again.'));
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().catch(() => {});
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Light-touch transcript sync: map elapsed time proportionally onto the
  // script lines so the current speaker's line is highlighted while playing.
  // (Per-line timestamps aren't available from the TTS endpoint, so this is an
  // approximation — good enough to follow along.)
  const activeLineIndex =
    isPlaying && duration > 0
      ? Math.min(script.length - 1, Math.floor((currentTime / duration) * script.length))
      : -1;

  return (
    <div className="w-full max-w-4xl mx-auto py-10 border-t border-slate-200 mt-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600">
            <Mic className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Duo Podcast Episode</h2>
            <p className="text-xs text-slate-500">
              An AI Host and Expert discuss this topic in two distinct voices.
            </p>
          </div>
        </div>

        <button
          onClick={handlePlayPause}
          disabled={isLoadingAudio}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 font-bold text-sm rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0"
        >
          {isLoadingAudio ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Synthesizing…</span>
            </>
          ) : isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>{activeAudioUrl ? 'Resume' : 'Play Episode'}</span>
            </>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Playback controls (visible once audio exists) */}
      {activeAudioUrl && (
        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <button
            onClick={handleRestart}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            title="Restart from beginning"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <span className="text-xs font-mono text-slate-500 tabular-nums w-10 text-right">
            {fmtTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPct}
            onChange={handleSeek}
            aria-label="Seek podcast"
            className="flex-1 h-1.5 accent-violet-600 cursor-pointer"
          />

          <span className="text-xs font-mono text-slate-500 tabular-nums w-10">
            {fmtTime(duration)}
          </span>

          {/* Hidden native element — we drive it with our own custom controls. */}
          <audio
            ref={audioRef}
            src={activeAudioUrl}
            preload="auto"
            className="hidden"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onCanPlay={() => {
              if (wantsAutoPlayRef.current && audioRef.current) {
                wantsAutoPlayRef.current = false;
                audioRef.current
                  .play()
                  .catch(() => setError('Tap play to start the episode.'));
              }
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            onError={() => {
              setError('The audio could not be loaded. Please try generating it again.');
              setIsPlaying(false);
            }}
          />
        </div>
      )}

      {/* Two-host transcript */}
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth">
        {script.map((turn, idx) => {
          const isHost = String(turn.speaker).toLowerCase() === 'host';
          const isActive = idx === activeLineIndex;
          return (
            <div
              key={idx}
              className={`flex gap-3 rounded-xl p-3 transition-colors ${
                isActive ? (isHost ? 'bg-slate-100' : 'bg-violet-50') : 'bg-transparent'
              }`}
            >
              <div
                className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
                  isHost ? 'bg-slate-200 text-slate-600' : 'bg-violet-100 text-violet-600'
                }`}
              >
                {isHost ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-bold tracking-widest uppercase mb-1 ${
                    isHost ? 'text-slate-500' : 'text-violet-600'
                  }`}
                >
                  {isHost ? 'Host' : 'Expert'}
                </div>
                <p className={`text-base leading-relaxed ${isHost ? 'text-slate-700' : 'text-slate-900'}`}>
                  {turn.line}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PodcastPlayer;
