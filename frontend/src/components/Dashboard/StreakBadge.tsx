'use client';

import React from 'react';
import { Flame, Trophy, CalendarCheck } from 'lucide-react';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
  weeklyCompletedDays: number;
  weeklyTarget?: number;
}

export default function StreakBadge({
  currentStreak,
  longestStreak,
  weeklyCompletedDays,
  weeklyTarget = 5,
}: StreakBadgeProps) {
  const isStreakActive = currentStreak > 0;
  const weeklyPct = Math.min(100, Math.round((weeklyCompletedDays / weeklyTarget) * 100));

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden shadow-xs">
      {/* Background glow decoration */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        {/* Left: Streak Flame & Number */}
        <div className="flex items-center gap-4">
          <div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-md transition-transform ${
              isStreakActive
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/30 animate-pulse'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Flame className="h-8 w-8 fill-current" />
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {currentStreak}
              </span>
              <span className="text-sm font-bold text-amber-700">
                {currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isStreakActive
                ? 'Keep the momentum going! Study today to maintain your streak.'
                : 'Complete a study session today to start your learning streak!'}
            </p>
          </div>
        </div>

        {/* Right: Longest record & Weekly progress */}
        <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-amber-500/20 pt-3 sm:pt-0 sm:pl-6">
          <div className="text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              <span>Record</span>
            </div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{longestStreak} days</div>
          </div>

          <div className="min-w-[120px]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1">
                <CalendarCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>This Week</span>
              </span>
              <span className="text-amber-800 font-bold">
                {weeklyCompletedDays}/{weeklyTarget}
              </span>
            </div>
            <div className="w-full h-2 bg-amber-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
