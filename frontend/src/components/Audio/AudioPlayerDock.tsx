import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Play, Pause, RotateCcw, Volume2, User, Eye, EyeOff, Music, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface AudioPlayerDockProps {
  sentences: string[];
}

export const AudioPlayerDock: React.FC<AudioPlayerDockProps> = ({ sentences }) => {
  const {
    isPlaying,
    activeSentenceIndex,
    speechRate,
    focusMode,
    activeVersionId,
    setPlaying,
    setActiveSentenceIndex,
    setSpeechRate,
    toggleFocusMode,
  } = useWorkspaceStore();

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  // Real, server-generated audio (google-tts-api) — additive to the browser-
  // voice playback above, not a replacement. activeVersionId is the current
  // Topic's database id (see workspaceStore's fetchNotesHistory/setActiveVersion).
  const [studioAudioUrl, setStudioAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);

  // Reset the studio audio player whenever the user switches to a different
  // notes version — a stale audioUrl from the previous topic must not persist.
  useEffect(() => {
    setStudioAudioUrl(null);
  }, [activeVersionId]);

  const handleGenerateStudioAudio = async () => {
    if (!activeVersionId || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const res = await axios.post('/api/tts/generate', { topicId: activeVersionId });
      if (res.data?.success) {
        setStudioAudioUrl(res.data.audioUrl);
        setTimeout(() => studioAudioRef.current?.play(), 100);
      }
    } catch (err) {
      console.error('Failed to generate studio audio:', err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        // Find a default English voice
        const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Sync speak when active sentence index changes or play changes
  useEffect(() => {
    if (!synthRef.current || sentences.length === 0) return;

    if (!isPlaying) {
      synthRef.current.pause();
      return;
    }

    if (synthRef.current.paused) {
      synthRef.current.resume();
      return;
    }

    // Cancel current speaking
    synthRef.current.cancel();

    const targetIndex = activeSentenceIndex === -1 ? 0 : activeSentenceIndex;
    if (targetIndex >= sentences.length) {
      setPlaying(false);
      setActiveSentenceIndex(-1);
      return;
    }

    if (activeSentenceIndex === -1) {
      setActiveSentenceIndex(0);
    }

    const textToSpeak = sentences[targetIndex];
    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Apply voice settings
    if (selectedVoiceName) {
      const activeVoice = voices.find(v => v.name === selectedVoiceName);
      if (activeVoice) utterance.voice = activeVoice;
    }

    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      // Transition to next sentence automatically
      if (targetIndex + 1 < sentences.length) {
        setActiveSentenceIndex(targetIndex + 1);
      } else {
        setPlaying(false);
        setActiveSentenceIndex(-1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('Speech synthesis error:', e);
      }
      setPlaying(false);
    };

    synthRef.current.speak(utterance);
  }, [isPlaying, activeSentenceIndex, sentences, selectedVoiceName, speechRate]);

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleReset = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setActiveSentenceIndex(0);
    setPlaying(true);
  };

  return (
    <div className="print:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-slate-800 px-8 flex items-center justify-between z-50">
      {/* Waveform graphic */}
      <div className="flex items-center space-x-2 w-1/4">
        <Volume2 className="h-5 w-5 text-amber-500" />
        <div className="flex items-end space-x-0.5 h-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-amber-500 rounded-full transition-all duration-300 ${
                isPlaying ? 'animate-pulse' : 'h-1'
              }`}
              style={{
                height: isPlaying ? `${Math.max(4, Math.random() * 24)}px` : '4px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center space-x-6">
        <button
          onClick={handleReset}
          className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          title="Restart Audio"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-955 rounded-full shadow-lg shadow-amber-500/20 transition-all"
        >
          {isPlaying ? <Pause className="h-6 w-6 text-slate-900 fill-slate-900" /> : <Play className="h-6 w-6 text-slate-900 fill-slate-900 ml-0.5" />}
        </button>

        <button
          onClick={toggleFocusMode}
          className={`p-2 rounded-full transition-colors ${
            focusMode ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
          title={focusMode ? "Disable Focus Mode" : "Enable Focus Mode"}
        >
          {focusMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {/* Settings Panel */}
      <div className="flex items-center space-x-4 w-1/4 justify-end">
        {/* Speed Selector */}
        <select
          value={speechRate}
          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 outline-none"
        >
          <option value="0.75">0.75x</option>
          <option value="1.0">1.0x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2.0">2.0x</option>
        </select>

        {/* Voice Selector */}
        <div className="flex items-center space-x-1">
          <User className="h-4 w-4 text-slate-400" />
          <select
            value={selectedVoiceName}
            onChange={(e) => setSelectedVoiceName(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 max-w-[120px] outline-none"
          >
            {voices
              .filter((v) => v.lang.startsWith('en'))
              .map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace('Microsoft', '').replace('Desktop', '').trim()}
                </option>
              ))}
          </select>
        </div>

        {/* Real, server-generated audio — separate from the browser-voice
            controls above on purpose, so existing sentence-sync playback
            keeps working exactly as it did before this was added. */}
        {studioAudioUrl ? (
          <audio ref={studioAudioRef} src={studioAudioUrl} controls className="h-8 max-w-[160px]" />
        ) : (
          <button
            onClick={handleGenerateStudioAudio}
            disabled={isGeneratingAudio || !activeVersionId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded text-xs font-medium transition-colors"
            title="Generate a real downloadable audio file for these notes"
          >
            {isGeneratingAudio ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Music className="h-4 w-4" />
            )}
            <span>{isGeneratingAudio ? 'Generating...' : 'Studio Audio'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
