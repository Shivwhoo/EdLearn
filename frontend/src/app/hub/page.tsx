'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  Users,
  Compass,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Info,
  History,
  Play,
  Headphones,
  MonitorPlay,
  X,
} from 'lucide-react';
import { redirectToApp, SsoApp } from '@/lib/ssoHandoff';
import Sidebar from '@/components/Layout/Sidebar';

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

/** Detail modal with an embedded player */
function PlayerModal({ item, onClose }: { item: any; onClose: () => void }) {
  const ytId = item.contentType === 'video' ? youtubeId(item.contentUrl) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player */}
        {ytId ? (
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title={item.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnailUrl} alt="" className="w-full h-56 object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <audio controls autoPlay src={item.contentUrl} className="w-full" />
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white mb-3">
                {item.contentType === 'video' ? (
                  <MonitorPlay className="h-3 w-3 text-red-400" />
                ) : (
                  <Headphones className="h-3 w-3 text-cyan-300" />
                )}
                {item.contentType === 'video' ? 'Video' : 'Podcast'} · {item.channelName}
              </span>
              <h3 className="text-lg font-bold text-white leading-snug">{item.title}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HubPage() {
  const router = useRouter();
  const { token, currentDay } = useWorkspaceStore();
  const [isMounted, setIsMounted] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState<SsoApp | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  const loadHistory = () => {
    try {
      const historyJson = localStorage.getItem('media_history');
      if (historyJson) {
        setHistory(JSON.parse(historyJson));
      }
    } catch (err) {
      console.error('Failed to load media history:', err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !token) {
      router.push('/login');
    }
  }, [isMounted, token, router]);

  useEffect(() => {
    if (isMounted && token) {
      loadHistory();
      window.addEventListener('mediaHistoryUpdate', loadHistory);
      return () => window.removeEventListener('mediaHistoryUpdate', loadHistory);
    }
  }, [isMounted, token]);

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
    <>
      <Sidebar />
      <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 md:ml-60 p-6 md:p-12 pt-24 md:pt-12">
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

        {/* Recently Viewed Media History */}
        <div className="mt-12 pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2 text-slate-800">
            <History className="h-5.5 w-5.5 text-slate-500" />
            <div>
              <h2 className="text-lg font-bold">Recently Listened & Watched</h2>
              <p className="text-xs text-slate-500 leading-normal">
                Quick access to your learning history across talks, podcasts, and videos.
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              No recent history. Play media on the Home page or Media Explorer to see it here!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {history.map((item) => {
                const isVideo = item.contentType === 'video';
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedMedia(item)}
                    className="group relative flex flex-col text-left rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden cursor-pointer animate-fade-in"
                  >
                    <div className="relative h-32 bg-slate-900 flex-shrink-0 w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                      <span className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center justify-center h-10 w-10 rounded-full bg-white/20 backdrop-blur border border-white/30 text-white">
                          <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                        </span>
                      </span>
                      <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-950/70 backdrop-blur border border-white/10 text-white">
                        {isVideo ? <MonitorPlay className="h-2.5 w-2.5 text-red-400" /> : <Headphones className="h-2.5 w-2.5 text-cyan-300" />}
                        {isVideo ? 'Video' : 'Podcast'}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <h3 className="clamp-2 text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors min-h-[2.6em]">{item.title}</h3>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span className="truncate max-w-[65%]">{item.channelName}</span>
                        <span>{timeAgo(item.watchedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </main>
    </>
  );
}

