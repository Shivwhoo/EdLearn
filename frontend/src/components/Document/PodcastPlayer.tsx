import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, User, Mic } from 'lucide-react';
import axios from 'axios';

interface PodcastScriptLine {
  speaker: 'Host' | 'Expert';
  line: string;
}

interface PodcastPlayerProps {
  topicId: string;
  script: PodcastScriptLine[];
  audioUrl?: string; // the database might already have it cached
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ topicId, script, audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(audioUrl || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state with audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [activeAudioUrl]);

  const handlePlayPause = async () => {
    // If we already have the audio generated, just toggle play/pause
    if (activeAudioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      return;
    }

    // Otherwise, we need to generate it first
    setIsLoadingAudio(true);
    try {
      const res = await axios.post('/api/tts/podcast', {
        topicId,
        script
      });
      if (res.data?.success && res.data.audioUrl) {
        setActiveAudioUrl(res.data.audioUrl);
        // Playback will happen via useEffect when activeAudioUrl changes and audio ref loads
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(console.error);
          }
        }, 100);
      }
    } catch (e) {
      console.error('Failed to generate podcast audio:', e);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-slate-900/60 border border-indigo-500/30 rounded-2xl space-y-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400">
            <Mic className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-100">Duo Podcast Episode</h2>
            <p className="text-xs text-slate-400">Listen to an AI host and expert discuss this topic.</p>
          </div>
        </div>

        <button
          onClick={handlePlayPause}
          disabled={isLoadingAudio}
          className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20"
        >
          {isLoadingAudio ? (
            <span className="flex items-center space-x-2">
              <span className="animate-pulse">Synthesizing Audio...</span>
            </span>
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

      {activeAudioUrl && (
        <div className="hidden">
          <audio ref={audioRef} src={activeAudioUrl} controls />
        </div>
      )}

      {/* Transcript View */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {script.map((turn, idx) => {
          const isHost = turn.speaker.toLowerCase() === 'host';
          return (
            <div key={idx} className={`flex ${isHost ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`flex max-w-[85%] space-x-3 p-4 rounded-2xl ${
                  isHost
                    ? 'bg-slate-800/80 border border-slate-700/50 rounded-bl-sm'
                    : 'bg-indigo-900/40 border border-indigo-500/30 rounded-br-sm flex-row-reverse space-x-reverse'
                }`}
              >
                <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                  isHost ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  <User className="h-4 w-4" />
                </div>
                
                <div className="space-y-1 mt-1">
                  <div className={`text-[10px] font-black uppercase tracking-wider ${
                    isHost ? 'text-slate-400' : 'text-indigo-400'
                  }`}>
                    {turn.speaker}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {turn.line}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PodcastPlayer;
