'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import LeftNavigationPanel from '@/components/Layout/LeftNavigationPanel';
import InteractiveAssistant from '@/components/Layout/InteractiveAssistant';
import LivingDocument from '@/components/Document/LivingDocument';
import { AudioPlayerDock } from '@/components/Audio/AudioPlayerDock';
import { Compass, RefreshCw, AlertCircle, Users, HelpCircle, Menu, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { redirectToApp, SsoApp } from '@/lib/ssoHandoff';

export default function WorkspacePage() {
  const router = useRouter();
  const {
    token,
    roadmap,
    currentDay,
    activeMode,
    userProfile,
    generatedContent,
    setGeneratedContent,
    setLoadingContent,
    isLoadingContent,
    fetchNotesHistory,
    fetchCurrentUser,
    restoringSession,
  } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [handoffLoading, setHandoffLoading] = useState<SsoApp | null>(null);
  const sentencesRef = useRef<string[]>([]);
  
  // Zen mode states
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Always restore session from database on page load
  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety routing — only fires after session restoration finishes
  useEffect(() => {
    if (isMounted && !restoringSession) {
      if (!token) {
        router.push('/login');
      } else if (!roadmap) {
        // Only redirect to onboarding if no roadmap exists at all after restore
        router.push('/onboarding');
      }
    }
  }, [isMounted, restoringSession, token, roadmap, router]);

  // Load history instantly when active day changes
  useEffect(() => {
    if (currentDay?.id) {
      fetchNotesHistory(currentDay.id);
    }
  }, [currentDay?.id, fetchNotesHistory]);

  // Fetch or trigger content generation when day or mode changes
  const handleGenerateContent = async () => {
    if (!currentDay) return;
    setLoadingContent(true);
    setErrorMsg('');
    try {
      const response = await axios.post('/api/generate', {
        topic: currentDay.title,
        mode: activeMode,
        difficulty: userProfile?.difficulty || 'Intermediate',
        dayId: currentDay.id,
      });

      if (response.data?.success) {
        // Refresh version history stack, which will automatically load this newly generated version
        await fetchNotesHistory(currentDay.id);
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

  // Shortcut buttons ("Find a Mentor" / "Career Guidance" / "Take a Quiz") —
  // same SSO handoff the AI Tutor chat uses when it detects one of these
  // intents automatically. The Quiz shortcut passes the current topic
  // automatically since EdLearn already knows it (currentDay.title) — the
  // user never has to say or pick a topic.
  const handleShortcut = async (app: SsoApp, topic?: string) => {
    if (handoffLoading) return;
    setHandoffLoading(app);
    setErrorMsg('');
    const ok = await redirectToApp(app, topic);
    if (!ok) {
      setErrorMsg(`Couldn't reach that app right now — please try again in a moment.`);
      setHandoffLoading(null);
    }
    // On success, the browser is navigating away — no need to reset state.
  };

  if (!isMounted || restoringSession || !roadmap || !currentDay) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span>Loading Workspace Context...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0F1117] flex flex-col justify-between overflow-hidden print:h-auto print:overflow-visible">
      {/* Top Banner Control Bar — hidden entirely when printing/exporting to PDF */}
      <header className="print:hidden h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsNavOpen(!isNavOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-xs font-semibold">
              Day {currentDay.dayNumber}
            </span>
            <h2 className="text-sm font-bold text-slate-200">{currentDay.title}</h2>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">
              <span className="text-slate-300 font-semibold">{userProfile?.careerGoal}</span>
            </span>
          </div>
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
            className="px-4 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 disabled:opacity-50 rounded text-xs font-bold transition-all cursor-pointer"
            title="Generate a fresh new version of the study notes for this day"
          >
            {isLoadingContent ? 'Generating...' : '+ New Version'}
          </button>
          <button 
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={`p-1.5 rounded-md transition-colors ${isAssistantOpen ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Toggle Assistant"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Panel grid — must stop clipping (overflow-hidden) during print,
          otherwise only the visible viewport slice of the notes gets exported
          to PDF instead of the full scrollable document. */}
      <div className={`flex flex-1 overflow-hidden print:h-auto print:overflow-visible print:flex-col relative ${generatedContent ? 'pb-20 print:pb-0' : ''}`}>
        {/* Left pane - Now a drawer on smaller screens or collapsible */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden border-r border-slate-800 bg-slate-950 z-10 ${isNavOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full absolute h-full border-r-0'}`}>
          <div className="w-80 h-full">
            <LeftNavigationPanel />
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 overflow-hidden flex flex-col items-center">
          <div className="w-full max-w-5xl h-full flex flex-col">
            <LivingDocument
              onTriggerGenerate={handleGenerateContent}
              sentenceRef={sentencesRef}
            />
          </div>
        </div>

        {/* Right pane - Overlay or collapsible */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden border-l border-slate-800 bg-slate-950 z-10 ${isAssistantOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full absolute right-0 h-full border-l-0'}`}>
          <div className="w-96 h-full">
            <InteractiveAssistant />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Player */}
      {generatedContent && (
        <AudioPlayerDock sentences={sentencesRef.current} />
      )}
    </div>
  );
}
