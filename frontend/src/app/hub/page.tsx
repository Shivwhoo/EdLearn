'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Users, Compass, HelpCircle, ArrowRight, RefreshCw, Info } from 'lucide-react';
import { redirectToApp, SsoApp } from '@/lib/ssoHandoff';

// NOTE: EdMentor / EdCompass haven't confirmed what they can share back
// with EdLearn yet (no cross-app access/credentials), so there's nothing
// real to fetch for these two cards. Until that integration exists, the
// flags below stay hardcoded to false so the Hub shows honest empty states
// instead of fake data. Once Person 1 confirms the API, replace these two
// consts with real values from useWorkspaceStore / an API call, and the
// SAMPLE_* objects below with the real fetched data.
const hasMentorSession = false;
const hasCompassResult = false;

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span>Loading Hub...</span>
      </div>
    );
  }

  const quizTopic = currentDay?.title;

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 p-6 md:p-12 pt-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900">Your Hub</h1>
          <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
            One place to see mentorship, career guidance, and quizzes across EdMentor, EdCompass, and EdQuiz — without logging in again.
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Mentor sessions and career assessment results will appear here automatically once EdMentor and EdCompass can share that data back with EdLearn.
          </span>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Next Mentor Session */}
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <Users className="h-5 w-5" />
                <h2 className="text-sm font-semibold text-slate-800">Your Next Mentor Session</h2>
              </div>
              {hasMentorSession ? (
                <>
                  <p className="text-sm text-slate-800 font-semibold">{SAMPLE_MENTOR_SESSION.mentorName}</p>
                  <p className="text-xs text-slate-500">{SAMPLE_MENTOR_SESSION.focus}</p>
                  <p className="text-xs text-slate-500">Scheduled: <span className="text-slate-800">{SAMPLE_MENTOR_SESSION.when}</span></p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  No upcoming mentor session. Book one via EdMentor.
                </p>
              )}
            </div>
            <button
              onClick={() => handleOpenApp('edmentor')}
              disabled={handoffLoading !== null}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all cursor-pointer"
            >
              {handoffLoading === 'edmentor' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>{hasMentorSession ? 'Open EdMentor' : 'Book via EdMentor'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Last EdCompass Result */}
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-500">
                <Compass className="h-5 w-5" />
                <h2 className="text-sm font-semibold text-slate-800">Your Last EdCompass Result</h2>
              </div>
              {hasCompassResult ? (
                <>
                  <p className="text-sm text-slate-800 font-semibold">{SAMPLE_COMPASS_RESULT.path}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{SAMPLE_COMPASS_RESULT.summary}</p>
                  <p className="text-xs text-slate-400">Scored: {SAMPLE_COMPASS_RESULT.scoredOn}</p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Take an assessment on EdCompass to see your career fit.
                </p>
              )}
            </div>
            <button
              onClick={() => handleOpenApp('edcompass')}
              disabled={handoffLoading !== null}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all cursor-pointer"
            >
              {handoffLoading === 'edcompass' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>{hasCompassResult ? 'Open EdCompass' : 'Take Assessment'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Assigned Quiz */}
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <HelpCircle className="h-5 w-5" />
                <h2 className="text-sm font-semibold text-slate-800">Your Assigned Quiz</h2>
              </div>
              <p className="text-sm text-slate-800 font-semibold">
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
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all cursor-pointer"
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
