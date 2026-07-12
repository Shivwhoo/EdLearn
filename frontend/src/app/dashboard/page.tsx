'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  Calendar,
  History,
  PlusCircle,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  TrendingUp,
  Lightbulb,
  ChevronDown
} from 'lucide-react';
import axios from 'axios';

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, setRoadmap, selectDay } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [historyNotes, setHistoryNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Trending Skills widget state
  const [trends, setTrends] = useState<any[]>([]);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);

  // "Did You Know?" personalized facts feed state
  const [facts, setFacts] = useState<any[]>([]);
  const [isFactsLoading, setIsFactsLoading] = useState(true);
  const [isFactsRefreshing, setIsFactsRefreshing] = useState(false);
  const [expandedFactIndex, setExpandedFactIndex] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Protected route check
  useEffect(() => {
    if (isMounted && !token) {
      router.push('/login');
    }
  }, [isMounted, token, router]);

  // Fetch summary history logs
  useEffect(() => {
    if (!token || !isMounted) return;

    const fetchSummary = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const res = await axios.get('/api/dashboard/summary');
        if (res.data?.success) {
          setRoadmaps(res.data.roadmaps || []);
          setHistoryNotes(res.data.topics || []);
        } else {
          setErrorMsg('Failed to load user progress details.');
        }
      } catch (err: any) {
        console.error('Failed to load dashboard summary:', err);
        setErrorMsg(err.response?.data?.error || 'Could not communicate with backend database.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [token, isMounted]);

  // Fetch trending in-demand skills (market demand indicators)
  useEffect(() => {
    if (!token || !isMounted) return;

    const fetchTrends = async () => {
      setIsTrendsLoading(true);
      try {
        const res = await axios.get('/api/market-demand');
        if (res.data?.success) {
          setTrends(res.data.trends || []);
        }
      } catch (err) {
        console.warn('Failed to load market demand trends:', err);
      } finally {
        setIsTrendsLoading(false);
      }
    };

    fetchTrends();
  }, [token, isMounted]);

  // Fetch personalized "Did You Know?" facts feed
  useEffect(() => {
    if (!token || !isMounted) return;

    const fetchFacts = async () => {
      setIsFactsLoading(true);
      try {
        const res = await axios.get('/api/facts');
        if (res.data?.success) {
          setFacts(res.data.facts || []);
        }
      } catch (err) {
        console.warn('Failed to load facts feed:', err);
      } finally {
        setIsFactsLoading(false);
      }
    };

    fetchFacts();
  }, [token, isMounted]);

  const handleLoadMoreFacts = async () => {
    if (isFactsRefreshing) return;
    setIsFactsRefreshing(true);
    try {
      const res = await axios.get('/api/facts?fresh=true');
      if (res.data?.success) {
        setFacts((prev) => [...prev, ...(res.data.facts || [])]);
      }
    } catch (err) {
      console.warn('Failed to load more facts:', err);
    } finally {
      setIsFactsRefreshing(false);
    }
  };

  // Open an active roadmap in the workspace
  const handleOpenRoadmap = async (targetRoadmap: any) => {
    try {
      await axios.post('/api/user/active-roadmap', { roadmapId: targetRoadmap.id });
    } catch (err) {
      console.warn('Failed to persist active roadmap in cache:', err);
    }
    setRoadmap(targetRoadmap);
    router.push('/workspace');
  };

  // Open a specific note version history from list
  const handleOpenHistoricalNote = async (noteItem: any) => {
    const parentRoadmap = roadmaps.find(
      (r) => r.id === noteItem.day?.roadmap?.id
    );
    if (!parentRoadmap) return;

    const targetDay = parentRoadmap.days.find(
      (d: any) => d.id === noteItem.day?.id
    );
    if (!targetDay) return;

    try {
      await axios.post('/api/user/active-roadmap', { roadmapId: parentRoadmap.id });
    } catch (err) {
      console.warn('Failed to persist active roadmap in cache:', err);
    }

    setRoadmap(parentRoadmap);
    selectDay(targetDay);

    router.push('/workspace');
  };

  if (!isMounted || !token) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span>Verifying user context...</span>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#0F1117] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 p-6 md:p-12 pt-36 md:pt-40">
      {/* Visual background accents — anchored to this relatively-positioned
          <main>, not the viewport, so they no longer overlap the fixed
          PublicNavbar or sit outside the intended container. */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* User Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-100 tracking-tight">
              Study Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1.5">
              Welcome back, <span className="text-indigo-400 font-semibold">{user?.fullName || 'Student'}</span>! Resume your active goals or start a new subject.
            </p>
          </div>

          <button
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-95 cursor-pointer self-start md:self-center"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Learning Path</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-xs">Fetching learning summaries...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left/Center Panel - Active roadmaps list */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-400" />
                <span>Active Learning Paths</span>
              </h2>

              {roadmaps.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-4">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-full inline-block text-indigo-400">
                    <GraduationCap className="h-8 w-8" />
                  </div>
                  <h3 className="text-slate-350 font-bold">No roadmaps initialized</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You haven't initialized an AI-generated learning pathway yet. Click below to specify your topic target and durations!
                  </p>
                  <button
                    onClick={() => router.push('/onboarding')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Set Career Goal
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {roadmaps.map((r) => {
                    // Compute basic progress calculations (days completed)
                    const totalDays = r.days.length;
                    const generatedNotesCount = r.days.filter((d: any) => d.topics.length > 0).length;
                    const percentage = totalDays > 0 ? Math.round((generatedNotesCount / totalDays) * 100) : 0;

                    return (
                      <div
                        key={r.id}
                        className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors flex flex-col justify-between gap-6"
                      >
                        <div className="space-y-2">
                          <h3 className="text-md font-bold text-slate-200">{r.title}</h3>
                          <div className="flex items-center space-x-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Deadline: {new Date(r.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span>•</span>
                            <span>
                              {totalDays} Days Structured
                            </span>
                          </div>
                        </div>

                        {/* Progress slider bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-500">Topics Studied</span>
                            <span className="text-indigo-400">{percentage}% ({generatedNotesCount}/{totalDays} Days)</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1.5 rounded-full"
                              style={{ width: `${Math.max(percentage, 5)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end border-t border-slate-800/40 pt-4">
                          <button
                            onClick={() => handleOpenRoadmap(r)}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all cursor-pointer group"
                          >
                            <span>Open Study Workspace</span>
                            <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Panel - History of generated notes */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <History className="h-5 w-5 text-amber-500" />
                <span>Study Guide History</span>
              </h2>

              {historyNotes.length === 0 ? (
                <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-555 py-12 text-xs">
                  No note runs generated yet. When you compile study notes, they will appear here.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {historyNotes.map((n) => (
                    <div
                      key={n.id}
                      className="bg-slate-900/50 border border-slate-850 hover:border-slate-800 rounded-xl p-4.5 hover:bg-slate-900/90 transition-all flex justify-between items-center gap-4 group"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-xs font-bold text-slate-300 truncate">{n.title}</h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {n.day?.roadmap?.title || 'Custom Path'} • Day {n.day?.dayNumber}
                        </p>
                        <p className="text-[9px] text-slate-650">
                          Generated: {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenHistoricalNote(n)}
                        className="p-2 bg-indigo-600/10 border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:border-indigo-600 text-indigo-400 group-hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Open this lesson notes version"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trending Skills widget — in-demand skills pulled from market data */}
            <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <span>Trending Skills Right Now</span>
              </h2>

              {isTrendsLoading ? (
                <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                  <span>Loading market demand data...</span>
                </div>
              ) : trends.length === 0 ? (
                <p className="text-xs text-slate-500">No market demand data available yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
                  {trends.slice(0, 9).map((t: any) => (
                    <div
                      key={t._id || t.skill}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-3 text-center space-y-1"
                      title={`Source: ${t.source}`}
                    >
                      <p className="text-xs font-bold text-slate-200 truncate">{t.skill}</p>
                      <p className="text-[10px] text-emerald-400 font-semibold">{t.demandScore}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* "Did You Know?" personalized facts feed */}
            <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                <span>Did You Know?</span>
              </h2>

              {isFactsLoading ? (
                <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                  <span>Generating personalized facts...</span>
                </div>
              ) : facts.length === 0 ? (
                <p className="text-xs text-slate-500">No facts available yet — generate a learning path to see facts tailored to your subjects.</p>
              ) : (
                <>
                  <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                    {facts.map((f: any, idx: number) => {
                      const isExpanded = expandedFactIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setExpandedFactIndex(isExpanded ? null : idx)}
                          className="bg-slate-950/60 border border-slate-800 hover:border-amber-500/30 rounded-xl p-3.5 space-y-1 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-slate-300 leading-relaxed">{f.fact}</p>
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                          {f.relatedTopic && (
                            <p className="text-[10px] text-amber-400 font-semibold">{f.relatedTopic}</p>
                          )}
                          {isExpanded && (
                            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 mt-2 border-t border-slate-800">
                              {f.detail || 'No additional detail available for this fact.'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleLoadMoreFacts}
                    disabled={isFactsRefreshing}
                    className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isFactsRefreshing ? 'Loading more facts...' : 'Load more facts'}
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
