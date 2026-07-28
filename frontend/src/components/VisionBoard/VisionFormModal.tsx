'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import {
  Vision,
  VisionFieldErrors,
  VisionPayload,
  VISION_CATEGORIES,
  VISION_STATUSES,
  emptyVisionPayload,
  fileToDownscaledDataUrl,
  visionToPayload,
} from '@/lib/visionBoard';

/**
 * Add / Edit Vision modal. Follows the modal pattern already used by
 * BookModal and BadgeDetailModal — fixed overlay, click-outside and Escape to
 * close, body scroll locked, scrollable panel so it works on small screens.
 *
 * Validation runs client-side first (instant feedback) and merges any
 * field-level errors the API returns, so the two can never drift out of sync
 * in what the user sees.
 */

interface VisionFormModalProps {
  open: boolean;
  /** Existing vision to edit, or null when creating. */
  vision: Vision | null;
  saving: boolean;
  /** Field errors reported by the backend on a 400. */
  serverFieldErrors: VisionFieldErrors;
  /** Non-field error message (network, 500, ...). */
  serverError: string;
  onClose: () => void;
  onSubmit: (payload: VisionPayload) => void;
}

const MAX_TITLE = 120;
const MAX_QUOTE = 240;
const MAX_DESCRIPTION = 2000;

const inputClass = (hasError: boolean) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
  }`;

const labelClass = 'block text-xs font-semibold text-slate-700 mb-1.5';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] font-medium text-rose-600">{message}</p>;
}

/** Client-side rules, mirroring the backend validator. */
function validate(payload: VisionPayload): VisionFieldErrors {
  const errors: VisionFieldErrors = {};
  const title = payload.title.trim();

  if (!title) errors.title = 'Please give your vision a title.';
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (payload.description.trim().length > MAX_DESCRIPTION) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }
  if (payload.quote.trim().length > MAX_QUOTE) {
    errors.quote = `Keep the quote under ${MAX_QUOTE} characters.`;
  }

  const resourceUrl = payload.resourceUrl.trim();
  if (resourceUrl && !/^https?:\/\/\S+$/i.test(resourceUrl)) {
    errors.resourceUrl = 'Enter a valid link starting with https://';
  }

  const imageUrl = payload.imageUrl.trim();
  if (imageUrl && !/^(https?:\/\/\S+|data:image\/)/i.test(imageUrl)) {
    errors.imageUrl = 'Enter a valid image link starting with https:// or upload a file.';
  }

  if (payload.targetDate && Number.isNaN(new Date(payload.targetDate).getTime())) {
    errors.targetDate = 'Enter a valid target date.';
  }

  return errors;
}

export default function VisionFormModal({
  open,
  vision,
  saving,
  serverFieldErrors,
  serverError,
  onClose,
  onSubmit,
}: VisionFormModalProps) {
  const [form, setForm] = useState<VisionPayload>(emptyVisionPayload);
  const [errors, setErrors] = useState<VisionFieldErrors>({});
  const [imageBusy, setImageBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever the modal opens (fresh for create, prefilled for edit).
  useEffect(() => {
    if (!open) return;
    setForm(vision ? visionToPayload(vision) : emptyVisionPayload());
    setErrors({});
    setImageBusy(false);
    // Focus the first field so keyboard users land in the right place.
    const timer = setTimeout(() => titleInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open, vision]);

  // Escape to close + body scroll lock, matching the other modals in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const setField = <K extends keyof VisionPayload>(key: K, value: VisionPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the error for a field as soon as the user edits it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setImageBusy(true);
    setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setField('imageUrl', dataUrl);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: err instanceof Error ? err.message : 'That image could not be used.',
      }));
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || imageBusy) return;
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSubmit(form);
  };

  // Client errors win while typing; server errors fill in anything else.
  const fieldError = (key: keyof VisionPayload) => errors[key] || serverFieldErrors[key];
  const isBusy = saving || imageBusy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 py-8 backdrop-blur-sm sm:items-center"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-form-heading"
    >
      <div
        className="animate-scale-in w-full max-w-2xl rounded-3xl border border-slate-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <h2
              id="vision-form-heading"
              className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em] text-slate-900"
            >
              <Sparkles className="h-4.5 w-4.5 text-blue-600" />
              {vision ? 'Edit Vision' : 'Add a New Vision'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {vision
                ? 'Update the details of this goal.'
                : 'Describe what you are working towards — the clearer it is, the easier it is to chase.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">
          {serverError && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-600">
              {serverError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={labelClass} htmlFor="vision-title">
              Vision title <span className="text-rose-500">*</span>
            </label>
            <input
              id="vision-title"
              ref={titleInputRef}
              type="text"
              value={form.title}
              maxLength={MAX_TITLE}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Land a backend engineering internship"
              className={inputClass(!!fieldError('title'))}
              aria-invalid={!!fieldError('title')}
            />
            <FieldError message={fieldError('title')} />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass} htmlFor="vision-description">
              Description
            </label>
            <textarea
              id="vision-description"
              value={form.description}
              rows={3}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Why does this matter to you, and what does done look like?"
              className={`${inputClass(!!fieldError('description'))} resize-y`}
            />
            <FieldError message={fieldError('description')} />
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="vision-category">
                Category
              </label>
              <select
                id="vision-category"
                value={form.category}
                onChange={(e) => setField('category', e.target.value as VisionPayload['category'])}
                className={`${inputClass(!!fieldError('category'))} cursor-pointer`}
              >
                {VISION_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldError('category')} />
            </div>

            <div>
              <label className={labelClass} htmlFor="vision-status">
                Status
              </label>
              <select
                id="vision-status"
                value={form.status}
                onChange={(e) => setField('status', e.target.value as VisionPayload['status'])}
                className={`${inputClass(!!fieldError('status'))} cursor-pointer`}
              >
                {VISION_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldError('status')} />
            </div>
          </div>

          {/* Target date + Resource link */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="vision-target">
                Target date
              </label>
              <input
                id="vision-target"
                type="date"
                value={form.targetDate}
                onChange={(e) => setField('targetDate', e.target.value)}
                className={`${inputClass(!!fieldError('targetDate'))} cursor-pointer`}
              />
              <FieldError message={fieldError('targetDate')} />
            </div>

            <div>
              <label className={labelClass} htmlFor="vision-resource">
                Resource / link <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="vision-resource"
                type="url"
                inputMode="url"
                value={form.resourceUrl}
                onChange={(e) => setField('resourceUrl', e.target.value)}
                placeholder="https://..."
                className={inputClass(!!fieldError('resourceUrl'))}
              />
              <FieldError message={fieldError('resourceUrl')} />
            </div>
          </div>

          {/* Motivational quote */}
          <div>
            <label className={labelClass} htmlFor="vision-quote">
              Motivational quote <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="vision-quote"
              type="text"
              value={form.quote}
              maxLength={MAX_QUOTE}
              onChange={(e) => setField('quote', e.target.value)}
              placeholder="A line that keeps you going"
              className={inputClass(!!fieldError('quote'))}
            />
            <FieldError message={fieldError('quote')} />
          </div>

          {/* Image: upload (downscaled in-browser) or paste a URL */}
          <div>
            <span className={labelClass}>
              Image <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-36">
                {imageBusy ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                ) : form.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="Vision preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setField('imageUrl', '')}
                      aria-label="Remove image"
                      className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-slate-500 transition-colors hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">No image</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="url"
                  inputMode="url"
                  value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
                  onChange={(e) => setField('imageUrl', e.target.value)}
                  placeholder={form.imageUrl.startsWith('data:') ? 'Uploaded image selected' : 'https://image-url...'}
                  disabled={form.imageUrl.startsWith('data:')}
                  className={`${inputClass(!!fieldError('imageUrl'))} disabled:bg-slate-50 disabled:text-slate-400`}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload image
                  </button>
                  <span className="text-[10px] leading-tight text-slate-400">
                    Resized in your browser before saving.
                  </span>
                </div>
                <FieldError message={fieldError('imageUrl')} />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : vision ? 'Save changes' : 'Add to board'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
