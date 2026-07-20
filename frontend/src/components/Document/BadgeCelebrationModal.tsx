'use client';

import React, { useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Award, X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Full-screen congratulations modal shown once, the moment a user completes
 * every day of a roadmap and the backend awards a course-completion Badge.
 * Driven entirely by `newBadge` in the workspace store — when the day-completion
 * request returns `newlyEarnedBadge`, the store sets it here and this pops.
 */
export const BadgeCelebrationModal: React.FC = () => {
  const { newBadge, dismissNewBadge } = useWorkspaceStore();

  useEffect(() => {
    if (!newBadge) return;

    // A bigger, celebratory burst than the per-day confetti.
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.6 },
        particleCount: Math.floor(220 * particleRatio),
        colors: ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6'],
        ...opts,
      });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, [newBadge]);

  if (!newBadge) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl text-center animate-scale-in">
        <button
          onClick={dismissNewBadge}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-center gap-1.5 text-amber-500 mb-4">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-widest">Badge Unlocked</span>
          <Sparkles className="h-4 w-4" />
        </div>

        {/* Medallion */}
        <div className="relative mx-auto w-28 h-28 mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 blur-md opacity-60 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-white">
            <Award className="h-14 w-14 text-white drop-shadow" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 tracking-[-0.02em]">Course Complete! 🎉</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          You finished every day of your roadmap. This badge is now saved to your profile.
        </p>

        <div className="mt-6 p-4 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl">
          <div className="text-sm font-bold text-slate-900">{newBadge.title}</div>
          {newBadge.description && (
            <div className="text-xs text-slate-500 mt-1">{newBadge.description}</div>
          )}
        </div>

        <button
          onClick={dismissNewBadge}
          className="mt-7 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all cursor-pointer"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};

export default BadgeCelebrationModal;
