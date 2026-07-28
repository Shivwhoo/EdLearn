'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Vision } from '@/lib/visionBoard';

/**
 * Confirmation dialog shown before a vision is permanently deleted.
 * Same overlay/animation conventions as the other modals in the app.
 */
interface DeleteVisionDialogProps {
  vision: Vision | null;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteVisionDialog({
  vision,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteVisionDialogProps) {
  useEffect(() => {
    if (!vision) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [vision, deleting, onCancel]);

  if (!vision) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={() => !deleting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-vision-heading"
    >
      <div
        className="animate-scale-in w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-vision-heading" className="text-base font-bold text-slate-900">
              Delete this vision?
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">&ldquo;{vision.title}&rdquo;</span> will be
              removed from your board. This can&apos;t be undone.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{deleting ? 'Deleting...' : 'Delete vision'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
