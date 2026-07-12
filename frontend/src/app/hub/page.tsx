'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Users, Compass, HelpCircle, ArrowRight, RefreshCw, Info } from 'lucide-react';
import { redirectToApp, SsoApp } from '@/lib/ssoHandoff';

// NOTE: All three cards below show SAMPLE data. Person 1 hasn't confirmed
// what EdMentor / EdCompass / EdQuiz can actually share back with EdLearn
// yet (no cross-app access/credentials), so there's nothing real to fetch.
// Once that's confirmed, replace SAMPLE_* below with real API calls and
// this note can come out.
const SAMPLE_MENTOR_SESSION = {
  mentorName: 'Aditi Rao',
  focus: 'System Design Fundamentals',
  when: 'Thu, 3:00 PM',
};

const SAMPLE_COMPASS_RESULT = {
  path: 'Backend Engineering',
  summary: 'Strong fit based on your last assessment — problem-solving and systems thinking scored highest.',
  scoredOn: '3 days ago',
};

export default function HubPage() {
  const router = useRouter();
  const { token, currentDay } = useWorkspaceStore();
  const [isMounted, setIsMounted] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState<SsoApp | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !token) {
      router.push('/login');
    }
  }, [isMounted, token, router]);

  const handleOpenApp = async (app: SsoApp, topic?: string) => {
    if (handoffLoading) return;
    setHandoffLoading(app);
    setErrorMsg('');
    const ok = await redirectToApp(app, topic);
    if (!ok) {
      setErrorMsg("Couldn't reach that app right now — please try again in a moment.");
      setHandoffLoading(null);
    }
  };

  if (!isMounted || !token) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span>Loading Hub...</span>
      </div>
    );
  }

  const quizTopic = currentDay?.title;

  return (
    <main className="relative min-h-screen bg-[#0F1117] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 p-6 md:p-12 pt-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-800/80 pb-6">
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Your Hub</h1>
          <p className="text-slate-400 text-sm mt-1.5">
            One place to see mentorship, career guidance, and quizzes across EdMentor, EdCompass, and EdQuiz — without logging in again.
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            The cards below show sample data for now. Real data from EdMentor and EdCompass will appear here once those apps can share it back with EdLearn.
          </span>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Next Mentor Session */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Users className="h-5 w-5" />
                <h2 className="text-sm font-bold text-slate-200">Your Next Mentor Session</h2>
              </div>
              <p className="text-sm text-slate-300 font-semibold">{SAMPLE_MENTOR_SESSION.mentorName}</p>
              <p className="text-xs text-slate-500">{SAMPLE_MENTOR_SESSION.focus}</p>
              <p className="text-xs text-slate-500">Scheduled: <span className="text-slate-300">{SAMPLE_MENTOR_SESSION.when}</span></p>
            </div>
            <button
              onClick={() => handleOpenApp('edmentor')}
              disabled={handoffLoading !== null}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {handoffLoading === 'edmentor' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Open EdMentor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Last EdCompass Result */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Compass className="h-5 w-5" />
                <h2 className="text-sm font-bold text-slate-200">Your Last EdCompass Result</h2>
              </div>
              <p className="text-sm text-slate-300 font-semibold">{SAMPLE_COMPASS_RESULT.path}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{SAMPLE_COMPASS_RESULT.summary}</p>
              <p className="text-xs text-slate-600">Scored: {SAMPLE_COMPASS_RESULT.scoredOn}</p>
            </div>
            <button
              onClick={() => handleOpenApp('edcompass')}
              disabled={handoffLoading !== null}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {handoffLoading === 'edcompass' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Open EdCompass</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Assigned Quiz */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <HelpCircle className="h-5 w-5" />
                <h2 className="text-sm font-bold text-slate-200">Your Assigned Quiz</h2>
              </div>
              <p className="text-sm text-slate-300 font-semibold">
                {quizTopic || 'Start a learning path to get a quiz assigned'}
              </p>
              <p className="text-xs text-slate-500">
                {quizTopic
                  ? 'Based on what you\'re currently studying in EdLearn.'
                  : 'Once you begin a topic, EdQuiz will test you on it automatically.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenApp('edquiz', quizTopic)}
              disabled={handoffLoading !== null || !quizTopic}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              title={!quizTopic ? 'Start a learning path first' : undefined}
            >
              {handoffLoading === 'edquiz' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Take Quiz</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
