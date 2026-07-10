'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import LeftNavigationPanel from '@/components/Layout/LeftNavigationPanel';
import InteractiveAssistant from '@/components/Layout/InteractiveAssistant';
import LivingDocument from '@/components/Document/LivingDocument';
import { AudioPlayerDock } from '@/components/Audio/AudioPlayerDock';
import { ShieldAlert, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function WorkspacePage() {
  const router = useRouter();
  const {
    roadmap,
    currentDay,
    activeMode,
    userProfile,
    generatedContent,
    setGeneratedContent,
    setLoadingContent,
    isLoadingContent,
  } = useWorkspaceStore();

  const [errorMsg, setErrorMsg] = useState('');
  const sentencesRef = useRef<string[]>([]);

  // Safety routing back to onboarding if roadmap is not defined
  useEffect(() => {
    if (!roadmap || !userProfile) {
      router.push('/');
    }
  }, [roadmap, userProfile, router]);

  // Fetch or trigger content generation when day or mode changes
  const handleGenerateContent = async () => {
    if (!currentDay || !userProfile) return;
    setLoadingContent(true);
    setErrorMsg('');
    try {
      const response = await axios.post('/api/generate', {
        topic: currentDay.title,
        mode: activeMode,
        difficulty: userProfile.difficulty,
        dayId: currentDay.id,
      });

      if (response.data?.success) {
        setGeneratedContent(response.data.data);
      } else {
        setErrorMsg('Error generating content. Please check API Key status.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to communicate with AI Services.');
    } finally {
      setLoadingContent(false);
    }
  };

  if (!roadmap || !currentDay) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span>Loading Workspace Context...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0F1117] flex flex-col justify-between overflow-hidden">
      {/* Top Banner Control Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-xs font-semibold">
            Day {currentDay.dayNumber}
          </span>
          <h2 className="text-sm font-bold text-slate-200">{currentDay.title}</h2>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-400">
            Goal: <span className="text-slate-300 font-semibold">{userProfile?.careerGoal}</span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {errorMsg && (
            <div className="flex items-center space-x-1.5 text-xs text-rose-400 bg-rose-500/5 px-3 py-1.5 rounded border border-rose-500/10">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}
          <button
            onClick={handleGenerateContent}
            disabled={isLoadingContent}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-all cursor-pointer"
          >
            {isLoadingContent ? 'Synchronizing...' : 'Reload AI Lesson'}
          </button>
        </div>
      </header>

      {/* Main Panel grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane */}
        <LeftNavigationPanel />

        {/* Center Canvas */}
        <LivingDocument
          onTriggerGenerate={handleGenerateContent}
          sentenceRef={sentencesRef}
        />

        {/* Right pane */}
        <InteractiveAssistant />
      </div>

      {/* Bottom Sticky Player */}
      {generatedContent && (
        <AudioPlayerDock sentences={sentencesRef.current} />
      )}
    </div>
  );
}
