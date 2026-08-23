'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowRight,
  Compass,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import Sidebar from '@/components/Layout/Sidebar';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * /roadmap — a dedicated, standalone page for generating an AI study
 * roadmap, decoupled from both onboarding (first-time profile setup) and
 * the Vision Board (which is strictly for tracking goals, not generating
 * roadmaps — see VisionRoadmapSection.tsx). Reachable any time from the
 * Dashboard's "Create New Roadmap" button.
 *
 * Same POST /api/roadmap contract onboarding uses, just without the
 * profile-setup side effects (no fullName field, no PATCH /api/profile) —
 * this is for an already-onboarded student who just wants another roadmap.
 */
export default function RoadmapGeneratorPage() {
  const router = useRouter();
  const { token, setRoadmap, selectDay, logout } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [availableTime, setAvailableTime] = useState(45);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ Helper to get token from store OR localStorage — mirrors dashboard/page.tsx
  const getAuthToken = () => {
    if (typeof window === 'undefined') return token;
    return token || localStorage.getItem('edlearn_token') || null;
  };

  // Protected route
  useEffect(() => {
    if (isMounted && !getAuthToken()) {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) {
      setErrorMsg('Tell us what you want to learn before generating a roadmap.');
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) {
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Default deadline, same as onboarding — this page doesn't collect one.
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 5);

      const response = await axios.post(
        '/api/roadmap',
        {
          goal,
          deadline: deadlineDate.toISOString(),
          availableTime: availableTime.toString(),
          difficulty,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data?.success) {
        setRoadmap(response.data.roadmap);

        // Auto-select the first day so workspace doesn't show infinite spinner
        if (response.data.roadmap?.days?.length > 0) {
          selectDay(response.data.roadmap.days[0]);
        }

        router.push('/workspace');
      } else {
        setErrorMsg('Failed to generate your roadmap. Please try again.');
      }
    } catch (err: any) {
      console.error('Roadmap generation error:', err);
      if (err.response?.status === 401) {
        logout();
        if (typeof window !== 'undefined') localStorage.removeItem('edlearn_token');
        router.push('/login');
        return;
      }
      setErrorMsg(err.response?.data?.error || "We couldn't generate a roadmap right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const authToken = isMounted ? getAuthToken() : null;

  if (!isMounted || !authToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <RefreshCw className="mr-2 h-6 w-6 animate-spin text-blue-600" />
        <span>Verifying user context...</span>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 p-6 pt-24 md:ml-60 md:p-12 md:pt-12">
        <div className="pointer-events-none absolute left-10 top-10 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-10 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-[-0.02em] text-slate-900">
              <Compass className="h-6 w-6 text-blue-600" />
              Create a New Roadmap
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Tell the AI what you want to learn, and it will structure a day-by-day study plan for you.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
            {errorMsg && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3.5 text-xs text-rose-600">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  What do you want to learn?
                </label>
                <input
                  type="text"
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Next.js App Router, Quantum Physics, SQL Queries"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Experience Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Available Time (mins/day)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={availableTime}
                    onChange={(e) => setAvailableTime(parseInt(e.target.value, 10) || 45)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    <span>Generating your roadmap...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" />
                    <span>Generate Roadmap</span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
