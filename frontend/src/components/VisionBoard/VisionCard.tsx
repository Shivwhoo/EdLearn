'use client';

import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Quote as QuoteIcon,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { Vision, categoryMeta, statusMeta } from '@/lib/visionBoard';

/**
 * A single vision card. Visual language matches the dashboard's cards
 * (white surface, slate-100 border, rounded-2xl, soft hover lift) but leans on
 * an image/gradient header, category + status badges and a target-date
 * countdown so the board reads as a mood board rather than a data table.
 */

interface VisionCardProps {
  vision: Vision;
  isBusy?: boolean;
  onEdit: (vision: Vision) => void;
  onDelete: (vision: Vision) => void;
  onToggleAchieved: (vision: Vision) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

/** Friendly relative copy for the target date, e.g. "in 12 days" / "3 days ago". */
function describeTargetDate(targetDate: string, achieved: boolean) {
  const target = new Date(targetDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);

  if (achieved) return { label: `Target ${formatDate(targetDate)}`, tone: 'text-slate-500' };
  if (days === 0) return { label: 'Target date is today', tone: 'text-amber-600 font-semibold' };
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      label: `${overdue} day${overdue === 1 ? '' : 's'} past target`,
      tone: 'text-rose-600 font-semibold',
    };
  }
  if (days <= 14) return { label: `${days} day${days === 1 ? '' : 's'} to go`, tone: 'text-amber-600 font-semibold' };
  return { label: `Target ${formatDate(targetDate)}`, tone: 'text-slate-500' };
}

export default function VisionCard({
  vision,
  isBusy = false,
  onEdit,
  onDelete,
  onToggleAchieved,
}: VisionCardProps) {
  const category = categoryMeta(vision.category);
  const status = statusMeta(vision.status);
  const isAchieved = vision.status === 'achieved';
  const target = vision.targetDate ? describeTargetDate(vision.targetDate, isAchieved) : null;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isAchieved ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-100 hover:border-blue-200'
      }`}
    >
      {/* Header: uploaded/linked image, or a category gradient with its emoji. */}
      <div className="relative h-40 shrink-0 overflow-hidden shine-parent">
        {vision.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={vision.imageUrl}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isAchieved ? '' : 'saturate-[0.95]'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/55 via-slate-900/5 to-transparent" />
          </>
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${category.gradient}`}>
            <span className="text-5xl drop-shadow-sm" aria-hidden="true">
              {category.emoji}
            </span>
          </div>
        )}

        {/* Badges */}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${category.badge}`}
        >
          <span aria-hidden="true">{category.emoji}</span>
          {category.label}
        </span>
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${status.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>

        {isAchieved && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/30">
            <Trophy className="h-3 w-3" />
            Achieved
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3
            className={`text-base font-semibold leading-snug text-slate-900 ${
              isAchieved ? 'decoration-emerald-400/70' : ''
            }`}
          >
            {vision.title}
          </h3>
          {vision.description && (
            <p className="clamp-3 text-xs leading-relaxed text-slate-500">{vision.description}</p>
          )}
        </div>

        {vision.quote && (
          <blockquote className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <QuoteIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <p className="clamp-2 text-[11px] font-medium italic leading-relaxed text-blue-800">
              {vision.quote}
            </p>
          </blockquote>
        )}

        <div className="mt-auto space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {target && (
              <span className={`inline-flex items-center gap-1.5 ${target.tone}`}>
                <CalendarDays className="h-3.5 w-3.5" />
                {target.label}
              </span>
            )}
            {vision.resourceUrl && (
              <a
                href={vision.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                Resource
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span className="ml-auto text-slate-400">Added {formatDate(vision.createdAt)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onToggleAchieved(vision)}
              disabled={isBusy}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold tracking-[0.01em] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isAchieved
                  ? 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                  : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700'
              } ${isBusy ? '' : 'cursor-pointer'}`}
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isAchieved ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>{isAchieved ? 'Reopen' : 'Mark as Achieved'}</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(vision)}
              disabled={isBusy}
              aria-label={`Edit ${vision.title}`}
              title="Edit vision"
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-60 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(vision)}
              disabled={isBusy}
              aria-label={`Delete ${vision.title}`}
              title="Delete vision"
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
