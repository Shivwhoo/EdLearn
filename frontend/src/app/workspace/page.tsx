'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import LeftNavigationPanel from '@/components/Layout/LeftNavigationPanel';
import InteractiveAssistant from '@/components/Layout/InteractiveAssistant';
import LivingDocument from '@/components/Document/LivingDocument';
import { AudioPlayerDock } from '@/components/Audio/AudioPlayerDock';
import { RefreshCw, AlertCircle, Menu, MessageSquare } from 'lucide-react';
import axios from 'axios';

// ✅ Import ssoHandoff - make sure file exists
import { redirectToApp, type SsoApp } from '@/lib/ssoHandoff';

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

  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);


  // Client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);


  // Restore user only if missing
  useEffect(() => {
    if (isMounted && token && !userProfile) {
      fetchCurrentUser();
    }
  }, [isMounted, token, userProfile, fetchCurrentUser]);


  // Route protection
  useEffect(() => {

    if (!isMounted || restoringSession) return;

    if (!token) {
      router.push('/login');
      return;
    }

    if (!roadmap) {
      router.push('/onboarding');
      return;
    }

  }, [
    isMounted,
    restoringSession,
    token,
    roadmap,
    router
  ]);


  // Load notes after UI exists
  useEffect(() => {

    if (!currentDay?.id) return;

    const timer = setTimeout(() => {
      fetchNotesHistory(currentDay.id);
    }, 300);

    return () => clearTimeout(timer);

  }, [
    currentDay?.id,
    fetchNotesHistory
  ]);

  const handleGenerateContent = async () => {
    if (!currentDay) return;
    setLoadingContent(true);
    setErrorMsg('');
    try {
      const response = await axios.post(
        '/api/generate',
        {
          topic: currentDay.title,
          mode: activeMode,
          difficulty: userProfile?.difficulty || 'Intermediate',
          dayId: currentDay.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        // Set content immediately from response so user sees it right away
        if (response.data.data) {
          setGeneratedContent(response.data.data);
        }
        // Then refresh history (adds the new version to the version dropdown)
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

  // Shortcut buttons
  const handleShortcut = async (app: SsoApp, topic?: string) => {
    if (handoffLoading) return;
    setHandoffLoading(app);
    setErrorMsg('');
    const ok = await redirectToApp(app, topic);
    if (!ok) {
      setErrorMsg(`Couldn't reach that app right now — please try again in a moment.`);
      setHandoffLoading(null);
    }
  };

  console.log("Workspace state:", {
    token: !!token,
    roadmap,
    currentDay
  });

  // ✅ Loading state
  if (!isMounted || !token || !roadmap || !currentDay) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span>Loading Workspace Context...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col justify-between overflow-hidden print:h-auto print:overflow-visible">
      <header className="print:hidden h-14 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsNavOpen(!isNavOpen)}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded text-xs font-semibold">
              Day {currentDay.dayNumber}
            </span>
            <h2 className="text-sm font-bold text-slate-900">{currentDay.title}</h2>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500">
              <span className="text-slate-700 font-semibold">{userProfile?.careerGoal}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {errorMsg && (
            <div className="flex items-center space-x-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded border border-rose-100">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleGenerateContent}
            disabled={isLoadingContent}
            className="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50 rounded text-xs font-bold transition-all cursor-pointer"
          >
            {isLoadingContent ? 'Generating...' : '+ New Version'}
          </button>
          <button
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={`p-1.5 rounded-md transition-colors ${isAssistantOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden print:h-auto print:overflow-visible print:flex-col relative">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden border-r border-slate-200 bg-white z-10 ${isNavOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full absolute h-full border-r-0'}`}>
          <div className="w-80 h-full">
            <LeftNavigationPanel />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col items-center bg-white">
          <div className="w-full max-w-5xl h-full flex flex-col">
            <LivingDocument
              onTriggerGenerate={handleGenerateContent}
              sentenceRef={sentencesRef}
            />
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out overflow-hidden border-l border-slate-200 bg-white z-10 ${isAssistantOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full absolute right-0 h-full border-l-0'}`}>
          <div className="w-96 h-full">
            <InteractiveAssistant />
          </div>
        </div>
      </div>

      {generatedContent && (
        <AudioPlayerDock sentences={sentencesRef.current} />
      )}
    </div>
  );
}