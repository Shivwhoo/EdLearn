import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, User, Mic } from 'lucide-react';
import axios from 'axios';
import { useWorkspaceStore } from '@/store/workspaceStore';

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
  const { token } = useWorkspaceStore();
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
      }, {
        headers: { Authorization: `Bearer ${token}` },
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
    <div className="w-full max-w-4xl mx-auto py-12 border-t border-slate-200 mt-8 space-y-10">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Mic className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Duo Podcast Episode</h2>
            <p className="text-xs text-slate-500">Listen to an AI host and expert discuss this topic.</p>
          </div>
        </div>

        <button
          onClick={handlePlayPause}
          disabled={isLoadingAudio}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-bold text-sm rounded-full shadow-sm hover:shadow-md transition-all"
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
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 scroll-smooth">
        {script.map((turn, idx) => {
          const isHost = turn.speaker.toLowerCase() === 'host';
          return (
            <div key={idx} className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <div className={`text-xs font-bold tracking-widest uppercase ${
                  isHost ? 'text-slate-500' : 'text-blue-600'
                }`}>
                  {turn.speaker}
                </div>
              </div>
              <p className={`text-lg leading-relaxed ${
                isHost ? 'text-slate-700' : 'text-blue-900'
              }`}>
                {turn.line}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PodcastPlayer;
