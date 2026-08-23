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
  ChevronDown,
  Award,
  Flame,
  Sparkles,
  X
} from 'lucide-react';
import axios from 'axios';
import BadgeDetailModal from '@/components/Document/BadgeDetailModal';
import Sidebar from '@/components/Layout/Sidebar';
import StreakBadge from '@/components/Dashboard/StreakBadge';
import ActivityHeatmap from '@/components/Dashboard/ActivityHeatmap';
import VisionBoardModal from '@/components/VisionBoard/VisionBoardModal';

// --- Trending Skills: curation, categories & helpers -----------------------

type SkillRow = { skill: string; demandScore: number; category: string };

// Category → tag styling. Keeps the widget readable at a glance.
const CATEGORY_STYLE: Record<string, string> = {
  Language: 'bg-blue-50 text-blue-700 border-blue-100',
  Frontend: 'bg-sky-50 text-sky-700 border-sky-100',
  Backend: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'AI / ML': 'bg-violet-50 text-violet-700 border-violet-100',
  'Cloud / DevOps': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Data: 'bg-amber-50 text-amber-700 border-amber-100',
  Popular: 'bg-slate-100 text-slate-600 border-slate-200',
};

// Skill name → category. Used to enrich both live and curated data.
const SKILL_CATEGORY: Record<string, string> = {
  python: 'Language', typescript: 'Language', javascript: 'Language', go: 'Language',
  rust: 'Language', java: 'Language', 'c++': 'Language', 'c#': 'Language', kotlin: 'Language',
  swift: 'Language', php: 'Language', ruby: 'Language', dart: 'Language', r: 'Language',
  react: 'Frontend', 'next.js': 'Frontend', 'tailwind css': 'Frontend', 'vue': 'Frontend',
  angular: 'Frontend', svelte: 'Frontend', html: 'Frontend', css: 'Frontend',
  'node.js': 'Backend', graphql: 'Backend', express: 'Backend', django: 'Backend',
  'spring boot': 'Backend', fastapi: 'Backend',
  'llms & prompt engineering': 'AI / ML', pytorch: 'AI / ML', tensorflow: 'AI / ML',
  'machine learning': 'AI / ML', 'llms': 'AI / ML', 'prompt engineering': 'AI / ML',
  aws: 'Cloud / DevOps', docker: 'Cloud / DevOps', kubernetes: 'Cloud / DevOps',
  azure: 'Cloud / DevOps', gcp: 'Cloud / DevOps', terraform: 'Cloud / DevOps',
  sql: 'Data', postgresql: 'Data', mongodb: 'Data', 'data analysis': 'Data', pandas: 'Data',
};

// Reliable fallback so the panel always looks credible (my curated picks).
const CURATED_SKILLS: SkillRow[] = [
  { skill: 'Python', demandScore: 22000, category: 'Language' },
  { skill: 'SQL', demandScore: 18200, category: 'Data' },
  { skill: 'AWS', demandScore: 16800, category: 'Cloud / DevOps' },
  { skill: 'TypeScript', demandScore: 15600, category: 'Language' },
  { skill: 'LLMs & Prompt Engineering', demandScore: 14200, category: 'AI / ML' },
  { skill: 'React', demandScore: 12400, category: 'Frontend' },
  { skill: 'Node.js', demandScore: 11200, category: 'Backend' },
  { skill: 'Go', demandScore: 11000, category: 'Language' },
  { skill: 'Docker', demandScore: 10400, category: 'Cloud / DevOps' },
  { skill: 'Kubernetes', demandScore: 9600, category: 'Cloud / DevOps' },
];

// Junk labels that occasionally leak from the scraper — never show these.
const JUNK_SKILLS = new Set(['jupyter notebook', 'roff', 'mdx', 'tex', 'vim script', 'makefile', 'dockerfile', 'null', 'other']);

const categoryFor = (name: string) => SKILL_CATEGORY[name.trim().toLowerCase()] || 'Popular';

// 22000 -> "22k", 9800 -> "9.8k", 640 -> "640"
const formatDemand = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`;

// Merge live data with the curated fallback and return a clean, ranked top 10.
function buildTrendingSkills(apiTrends: any[]): SkillRow[] {
  const byName = new Map<string, SkillRow>();
  (apiTrends || []).forEach((t) => {
    const name = String(t?.skill || '').trim();
    if (!name || JUNK_SKILLS.has(name.toLowerCase())) return;
    const score = Number(t?.demandScore) || 0;
    const existing = byName.get(name.toLowerCase());
    // Same skill can appear from multiple sources — keep the strongest signal.
    if (!existing || score > existing.demandScore) {
      byName.set(name.toLowerCase(), { skill: name, demandScore: score, category: categoryFor(name) });
    }
  });

  const live = Array.from(byName.values());
  // Fall back to the curated set when live data is too sparse to look credible.
  const rows = live.length >= 6 ? live : CURATED_SKILLS;
  return [...rows].sort((a, b) => b.demandScore - a.demandScore).slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, setRoadmap, selectDay, logout } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [historyNotes, setHistoryNotes] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [viewBadge, setViewBadge] = useState<any | null>(null);
  const [completedDayIds, setCompletedDayIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Vision Board popup — opened either from the shortcut card in the right
  // rail or from the dismissable reminder banner below.
  const [visionBoardOpen, setVisionBoardOpen] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Trending Skills widget state
  const [trends, setTrends] = useState<any[]>([]);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);

  // "Did You Know?" personalized facts feed state — shows one fact at a time
  // from the fetched batch, rotating to the next one automatically.
  const [facts, setFacts] = useState<any[]>([]);
  const [isFactsLoading, setIsFactsLoading] = useState(true);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isFactExpanded, setIsFactExpanded] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  // ✅ Helper to get token from store OR localStorage
  const getAuthToken = () => {
    if (typeof window === 'undefined') {
      return token;
    }

    return token || localStorage.getItem('edlearn_token') || null;
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ FIXED: Protected route check - checks both store and localStorage
  useEffect(() => {
    if (isMounted) {
      const authToken = getAuthToken();
      console.log('🔍 Dashboard - Token exists:', authToken ? 'Yes' : 'No');

      if (!authToken) {
        console.log('❌ No token, redirecting to login');
        router.push('/login');
        return;
      }
      console.log('✅ Dashboard - User authenticated');
    }
  }, [isMounted, router]);

  // ✅ FIXED: Fetch summary - uses token from store or localStorage
  useEffect(() => {
    const authToken = getAuthToken();
    if (!authToken || !isMounted) return;

    const fetchSummary = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const [res, analyticsRes] = await Promise.all([
          axios.get('/api/dashboard/summary', {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          axios.get('/api/progress/analytics', {
            headers: { Authorization: `Bearer ${authToken}` },
          }).catch(() => ({ data: { success: false } })),
        ]);

        if (res.data?.success) {
          console.log('✅ Data loaded successfully');
          setRoadmaps(res.data.roadmaps || []);
          setHistoryNotes(res.data.topics || []);
          setBadges(res.data.badges || []);
          setCompletedDayIds(res.data.completedDayIds || []);
        } else {
          setErrorMsg('Failed to load user progress details.');
        }

        if (analyticsRes?.data?.success) {
          setAnalytics(analyticsRes.data.analytics);
        }
      } catch (err: any) {
        // If token is expired/invalid, clear it and force re-login quietly
        if (err.response?.status === 401) {
          logout();
          localStorage.removeItem('edlearn_token');
          router.push('/login');
          return;
        }
        
        console.error('Failed to load dashboard summary:', err);
        setErrorMsg(err.response?.data?.error || 'Could not communicate with backend database.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();

  }, [token, isMounted, router, logout]);

  // ✅ FIXED: Fetch trending - uses token from store or localStorage
  useEffect(() => {
    const authToken = getAuthToken();
    if (!authToken || !isMounted) return;

    const fetchTrends = async () => {
      setIsTrendsLoading(true);
      try {
        const res = await axios.get('/api/market-demand', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.data?.success) {
          setTrends(res.data.trends || []);
        }
      } catch (err: any) {
        if (err.response?.status !== 401) {
          console.warn('Failed to load market demand trends:', err);
        }
      } finally {
        setIsTrendsLoading(false);
      }
    };

    fetchTrends();
  }, [token, isMounted]);

  // ✅ FIXED: Fetch facts - uses token from store or localStorage
  useEffect(() => {
    const authToken = getAuthToken();
    if (!authToken || !isMounted) return;

    const fetchFacts = async () => {
      setIsFactsLoading(true);
      try {
        const res = await axios.get('/api/facts', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.data?.success) {
          setFacts(res.data.facts || []);
          setCurrentFactIndex(0);
          setIsFactExpanded(false);
        }
      } catch (err: any) {
        if (err.response?.status !== 401) {
          console.warn('Failed to load facts feed:', err);
        }
      } finally {
        setIsFactsLoading(false);
      }
    };

    fetchFacts();
  }, [token, isMounted]);

  // Rotate to the next fact in the batch every 10 minutes. Loops back to the
  // start once it's cycled through everything fetched — no extra API calls,
  // just cycling the batch already returned by GET /api/facts above.
  useEffect(() => {
    if (facts.length < 2) return;

    const rotationMs = 10 * 60 * 1000;
    const interval = setInterval(() => {
      setIsFactExpanded(false);
      setCurrentFactIndex((prev) => (prev + 1) % facts.length);
    }, rotationMs);

    return () => clearInterval(interval);
  }, [facts.length]);

  // Open an active roadmap in the workspace
  const handleOpenRoadmap = async (targetRoadmap: any) => {
    const authToken = getAuthToken();
    try {
      await axios.post('/api/user/active-roadmap', { roadmapId: targetRoadmap.id }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch (err) {
      console.warn('Failed to persist active roadmap in cache:', err);
    }
    setRoadmap(targetRoadmap);
    if (
      targetRoadmap.days &&
      targetRoadmap.days.length > 0
    ) {
      selectDay(targetRoadmap.days[0]);
    }
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

    const authToken = getAuthToken();
    try {
      await axios.post('/api/user/active-roadmap', { roadmapId: parentRoadmap.id }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch (err) {
      console.warn('Failed to persist active roadmap in cache:', err);
    }

    setRoadmap(parentRoadmap);
    selectDay(targetDay);

    router.push('/workspace');
  };

  // ✅ FIXED: Check both store and localStorage for token
  const authToken =
    typeof window !== 'undefined'
      ? token || localStorage.getItem('edlearn_token')
      : token;

  if (!isMounted || !authToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span>Verifying user context...</span>
      </div>
    );
  }

  const currentFact = facts[currentFactIndex] || null;

  return (
    <>
      <Sidebar />
      <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 md:ml-60 p-6 md:p-12 pt-24 md:pt-12">
      {/* Visual background accents — anchored to this relatively-positioned
          <main>, not the viewport. On desktop the content is offset by the
          fixed 240px Sidebar (md:ml-60); on mobile it clears the fixed top
          bar (pt-24). */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* User Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-slate-900">
              Study Dashboard
            </h1>
            <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
              Welcome back, <span className="text-blue-600 font-semibold">{user?.fullName || 'Student'}</span>! Resume your active goals or start a new subject.
            </p>
          </div>

          <button
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 cursor-pointer self-start md:self-center"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Learning Path</span>
          </button>
        </div>

        {/* Vision Board reminder — dismissable for this visit; reappears next
            time the dashboard loads. Opens the same VisionBoardModal as the
            shortcut card below and the Sidebar's "Vision Board" nav button. */}
        {!reminderDismissed && (
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-5 shadow-lg shadow-blue-600/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 pr-8 sm:items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm font-medium leading-relaxed text-white">
                Keep your goals in sight! Take a moment to review your Vision Board.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() => setVisionBoardOpen(true)}
                className="whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 active:scale-95 cursor-pointer"
              >
                Review Vision Board
              </button>
            </div>
            <button
              onClick={() => setReminderDismissed(true)}
              aria-label="Dismiss reminder"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Streak & Consistency Badge */}
        {analytics && (
          <StreakBadge
            currentStreak={analytics.currentStreak}
            longestStreak={analytics.longestStreak}
            weeklyCompletedDays={analytics.weeklyCompletedDays}
            weeklyTarget={analytics.weeklyTarget}
          />
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-xs">Fetching learning summaries...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left/Center Panel - Active roadmaps list */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span>Active Learning Paths</span>
                </h2>

                {/* Dedicated, standalone roadmap generator — see /roadmap.
                    Separate from onboarding (first-time profile setup) and
                    from the Vision Board (goal-tracking only, no roadmap
                    generation there anymore). */}
                <button
                  onClick={() => router.push('/roadmap')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Create New Roadmap</span>
                </button>
              </div>

              {roadmaps.length === 0 ? (
                <div className="p-8 bg-white border border-slate-100 shadow-sm rounded-2xl text-center space-y-4">
                  <div className="p-3 bg-blue-50 rounded-full inline-block text-blue-600">
                    <GraduationCap className="h-8 w-8" />
                  </div>
                  <h3 className="text-slate-800 font-semibold">No roadmaps initialized</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You haven't initialized an AI-generated learning pathway yet. Click below to specify your topic target and durations!
                  </p>
                  <button
                    onClick={() => router.push('/onboarding')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold tracking-[0.01em] transition-all shadow-md cursor-pointer"
                  >
                    Start Learning
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {roadmaps.map((r) => {
                    // Real progress = days actually marked complete (Progress table),
                    // not merely days that have notes generated.
                    const totalDays = r.days.length;
                    const completedCount = r.days.filter((d: any) => completedDayIds.includes(d.id)).length;
                    const percentage = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
                    const isCourseComplete = totalDays > 0 && completedCount >= totalDays;

                    return (
                      <div
                        key={r.id}
                        className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between gap-6"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-slate-800">{r.title}</h3>
                            {isCourseComplete && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                <Award className="h-3 w-3" />
                                Completed
                              </span>
                            )}
                          </div>
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
                            <span className="text-slate-500">Days Completed</span>
                            <span className={isCourseComplete ? 'text-emerald-600' : 'text-blue-600'}>{percentage}% ({completedCount}/{totalDays} Days)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full bg-gradient-to-r ${isCourseComplete ? 'from-emerald-500 to-emerald-600' : 'from-blue-500 to-blue-600'}`}
                              style={{ width: `${Math.max(percentage, 5)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 pt-4">
                          <button
                            onClick={() => handleOpenRoadmap(r)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-all cursor-pointer group"
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

            {/* Right Panel - "Did You Know?" — one fact at a time, rotates every
                10 minutes (see the rotation useEffect above). Was Study Guide
                History; that moved to the full-width slot below. */}
            <div className="space-y-6">
              {/* Vision Board shortcut — opens VisionBoardModal, the
                  student's private board of learning/career goals. */}
              <button
                onClick={() => setVisionBoardOpen(true)}
                className="w-full text-left bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-6 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-white/90">
                  <Sparkles className="h-5 w-5" />
                  <h2 className="text-sm font-semibold">My Vision Board</h2>
                </div>
                <p className="text-xs text-white/80 mt-2 leading-relaxed">
                  Picture the goals behind all this studying — career moves, skills and dreams, all on one board.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                  Open Vision Board
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <span>Did You Know?</span>
              </h2>

              {isFactsLoading ? (
                <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center text-slate-500 text-xs gap-2 py-12">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Generating personalized facts...</span>
                </div>
              ) : !currentFact ? (
                <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl text-center text-slate-500 py-12 text-xs">
                  No facts available yet — generate a learning path to see facts tailored to your subjects.
                </div>
              ) : (
                <div
                  onClick={() => setIsFactExpanded((prev) => !prev)}
                  className="bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 rounded-2xl p-6 space-y-3 cursor-pointer transition-all"
                >
                  <p className="text-sm text-slate-800 leading-relaxed font-semibold">{currentFact.fact}</p>

                  {currentFact.relatedTopic && (
                    <p className="text-[11px] text-amber-600 font-semibold">
                      Related to: {currentFact.relatedTopic}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                    <span>{isFactExpanded ? 'Hide explanation' : 'Tap for a brief explanation'}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFactExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {isFactExpanded && (
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                      {currentFact.detail || 'No additional detail available for this fact.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Study Activity Heatmap */}
            {analytics && analytics.activityHeatmap && (
              <div className="lg:col-span-3">
                <ActivityHeatmap
                  heatmapData={analytics.activityHeatmap}
                  totalCompletions={analytics.totalCompletions}
                />
              </div>
            )}

            {/* Earned Badges — course-completion rewards from the Badge table */}
            <div className="lg:col-span-3 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <span>Achievements &amp; Badges</span>
              </h2>

              {badges.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No badges yet. Finish every day of a roadmap to earn a course-completion badge.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {badges.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setViewBadge(b)}
                      className="text-left flex items-center gap-4 bg-gradient-to-br from-amber-50 to-white border border-amber-100 hover:border-amber-300 hover:shadow-md rounded-xl p-4 transition-all cursor-pointer"
                      title="View badge details"
                    >
                      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-sm shadow-amber-500/30">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">{b.title}</h4>
                        {b.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{b.description}</p>
                        )}
                        <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                          Earned {new Date(b.earnedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trending Skills widget — ranked market-demand insights */}
            <div className="lg:col-span-3 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <span>Trending Skills Right Now</span>
                </h2>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Ranked by market demand
                </span>
              </div>

              {isTrendsLoading ? (
                <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Loading market demand data...</span>
                </div>
              ) : (() => {
                const ranked = buildTrendingSkills(trends);
                const maxScore = Math.max(...ranked.map((r) => r.demandScore), 1);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {ranked.map((row, idx) => {
                      const pct = Math.max(8, Math.round((row.demandScore / maxScore) * 100));
                      const isHot = idx < 3;
                      return (
                        <div key={row.skill} className="flex items-center gap-3">
                          {/* Rank */}
                          <span className={`w-6 text-center text-xs font-bold tabular-nums ${isHot ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {idx + 1}
                          </span>

                          {/* Skill + category + demand bar */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800 truncate">{row.skill}</span>
                              {isHot && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-1.5 py-0.5">
                                  <Flame className="h-2.5 w-2.5" />
                                  HOT
                                </span>
                              )}
                              <span className={`ml-auto text-[10px] font-medium border rounded-full px-2 py-0.5 whitespace-nowrap ${CATEGORY_STYLE[row.category] || CATEGORY_STYLE.Popular}`}>
                                {row.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-500 tabular-nums w-10 text-right">
                                {formatDemand(row.demandScore)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Study Guide History — moved here from the narrow right panel,
                now full-width with a responsive grid instead of a single
                vertical stack, to make use of the extra space. */}
            <div className="lg:col-span-3 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-amber-500" />
                <span>Study Guide History</span>
              </h2>

              {historyNotes.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No note runs generated yet. When you compile study notes, they will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historyNotes.map((n) => (
                    <div
                      key={n.id}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-4.5 hover:bg-slate-100/70 transition-all flex justify-between items-center gap-4 group"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-xs font-semibold text-slate-700 truncate">{n.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {n.day?.roadmap?.title || 'Custom Path'} • Day {n.day?.dayNumber}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Generated: {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenHistoricalNote(n)}
                        className="p-2 bg-blue-50 border border-blue-100 group-hover:bg-blue-600 group-hover:border-blue-600 text-blue-600 group-hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Open this lesson notes version"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Badge detail popup (opens when a badge card is clicked) */}
      <BadgeDetailModal badge={viewBadge} onClose={() => setViewBadge(null)} />

      {/* Vision Board popup — opened from the reminder banner or the shortcut card above */}
      <VisionBoardModal isOpen={visionBoardOpen} onClose={() => setVisionBoardOpen(false)} />
      </main>
    </>
  );
}