'use client';

import React from 'react';
import { Award, X, Calendar } from 'lucide-react';
import type { Badge } from '@/store/workspaceStore';

interface BadgeDetailModalProps {
  badge: Badge | null;
  onClose: () => void;
}

/**
 * Detail popup shown when a user clicks one of their earned badges (from the
 * left-panel shelf or the dashboard). Read-only — just a larger, framed view of
 * the badge with its full title, description, and the date it was earned.
 */
export const BadgeDetailModal: React.FC<BadgeDetailModalProps> = ({ badge, onClose }) => {
  if (!badge) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl text-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Medallion */}
        <div className="relative mx-auto w-28 h-28 mb-6 mt-2">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 blur-md opacity-50" />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-white">
            <Award className="h-14 w-14 text-white drop-shadow" />
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 tracking-[-0.01em]">{badge.title}</h2>

        {badge.description && (
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{badge.description}</p>
        )}

        <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Earned {new Date(badge.earnedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>

        <button
          onClick={onClose}
          className="mt-7 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default BadgeDetailModal;
