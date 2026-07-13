'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GraduationCap, ArrowRight, Sparkles, Code, BrainCircuit, ShieldAlert, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function OnboardingPage() {
  const router = useRouter();
  const { token, user, setUserProfile, setRoadmap, logout } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [availableTime, setAvailableTime] = useState(45);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Protection Gate
  useEffect(() => {
    if (isMounted && !token) {
      router.push('/login');
    }
  }, [isMounted, token, router]);

  // Set default full name from registration user context
  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !goal.trim()) {
      setErrorMsg('Please specify both your name and target learning goal.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Set default deadline to 5 days from now
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 5);

      // Create target roadmap via backend (Authorization token is automatically attached by Zustand store axios settings)
      const response = await axios.post('/api/roadmap', {
        goal,
        deadline: deadlineDate.toISOString(),
        availableTime: availableTime.toString(),
        difficulty,
      });

      if (response.data?.success) {
        // H6: Persist profile to DB so session restores always have real data (not synthetic fallback)
        await axios.patch('/api/profile', {
          fullName,
          careerGoal: goal,
          currentSkills: [],
          availableTime: availableTime.toString(),
          difficulty,
        }).catch((err) => console.warn('Profile persist warning:', err));

        setUserProfile({
          fullName,
          careerGoal: goal,
          currentSkills: [],
          availableTime,
          difficulty,
        });

        setRoadmap(response.data.roadmap);
        router.push('/workspace');
      } else {
        setErrorMsg('Failed to process your personalized roadmap. Verify server environment settings.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        // Session token has no database match (e.g. database was reset) — logout and send to signup
        logout();
        router.push('/signup');
        return;
      }
      setErrorMsg(err.response?.data?.error || 'Database connection timed out. Ensure PostgreSQL is active.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span>Verifying session...</span>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-white flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl" />

      <div className="w-full max-w-xl bg-white rounded-2xl p-8 space-y-6 relative z-10 shadow-xl border border-slate-100">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-blue-600 rounded-full text-white">
            <GraduationCap className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
            Welcome to <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">EdLearn</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-sm">
            Replace passive watching with active, citation-backed, retrieval-augmented education.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">Your Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">What do you want to learn?</label>
            <input
              type="text"
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Next.js App Router, Quantum Physics, SQL Queries"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">Experience Level</label>
              <select
                value={difficulty}
                onChange={(e: any) => setDifficulty(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">Available Study (Mins/Day)</label>
              <input
                type="number"
                min="10"
                max="180"
                value={availableTime}
                onChange={(e) => setAvailableTime(parseInt(e.target.value) || 45)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Generating Roadmap & Modules...</span>
              </>
            ) : (
              <>
                <span>Generate Smart Roadmap</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-6 flex justify-around text-center">
          <div className="flex flex-col items-center">
            <Sparkles className="h-5 w-5 text-amber-500 mb-1" />
            <span className="text-[11px] font-medium text-slate-500">6 Adaptive Pedagogical Modes</span>
          </div>
          <div className="flex flex-col items-center">
            <Code className="h-5 w-5 text-blue-600 mb-1" />
            <span className="text-[11px] font-medium text-slate-500">Active Build Challenges</span>
          </div>
          <div className="flex flex-col items-center">
            <BrainCircuit className="h-5 w-5 text-emerald-600 mb-1" />
            <span className="text-[11px] font-medium text-slate-500">Anti-Hallucination RAG</span>
          </div>
        </div>
      </div>
    </main>
  );
}
