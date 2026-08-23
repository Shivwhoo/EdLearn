'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Flag,
  Loader2,
  MapPin,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Milestone,
  MilestoneFieldErrors,
  MilestonePayload,
  Vision,
  createMilestone,
  deleteMilestoneApi,
  fetchMilestones,
  generateCareerMilestones,
  readMilestoneFieldErrors,
  readableError,
  toggleMilestoneComplete,
  updateMilestone,
} from '@/lib/visionBoard';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TITLE = 120;
const MAX_DESC  = 500;

const emptyForm = (): MilestonePayload => ({
  title:       '',
  description: '',
  targetDate:  '',
  visionId:    '',
  completed:   false,
  sortOrder:   0,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

/** Friendly relative label, e.g. "in 5 days" / "2 days overdue". */
function targetLabel(targetDate: string | null, completed: boolean): { text: string; tone: string } {
  if (!targetDate) return { text: '', tone: '' };

  const target = new Date(targetDate);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const days   = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (completed) return { text: formatDate(targetDate), tone: 'text-slate-400' };
  if (days === 0) return { text: 'Due today', tone: 'text-amber-600 font-semibold' };
  if (days < 0)  return { text: `${Math.abs(days)}d overdue`, tone: 'text-rose-600 font-semibold' };
  if (days <= 7) return { text: `${days}d to go`, tone: 'text-amber-600 font-semibold' };
  return { text: formatDate(targetDate), tone: 'text-slate-500' };
}

function sortMilestones(milestones: Milestone[]): Milestone[] {
  const incomplete = milestones
    .filter((m) => !m.completed)
    .sort((a, b) => {
      if (!a.targetDate && !b.targetDate) return a.sortOrder - b.sortOrder;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

  const done = milestones
    .filter((m) => m.completed)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return [...incomplete, ...done];
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

const inputCls = (err?: boolean) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
    err
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
  }`;

const labelCls = 'block text-xs font-semibold text-slate-700 mb-1.5';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-[11px] font-medium text-rose-600">{msg}</p>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Existing visions to populate the "linked vision" dropdown. */
  visions: Vision[];
  /** Authenticated token — required for all API calls. */
  token:   string;
}

export default function VisionRoadmapSection({ visions, token }: Props) {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [loadError, setLoadError]   = useState('');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState<MilestonePayload>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<MilestoneFieldErrors>({});
  const [formError, setFormError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // ── Busy state for individual card actions ───────────────────────────────────
  const [busyId, setBusyId]         = useState<string | null>(null);

  // ── Collapse completed section ───────────────────────────────────────────────
  const [showCompleted, setShowCompleted] = useState(true);

  // ── Career Roadmap generator state ───────────────────────────────────────────
  const [careerGoal, setCareerGoal]         = useState('');
  const [isGenerating, setIsGenerating]     = useState(false);
  const [generateError, setGenerateError]   = useState('');

  const titleRef = useRef<HTMLInputElement>(null);

  // ── Load from API on mount ───────────────────────────────────────────────────
  const loadMilestones = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchMilestones(token);
      setMilestones(data);
    } catch (err) {
      setLoadError(readableError(err, "We couldn't load your milestones. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // Focus title when form opens
  useEffect(() => {
    if (formOpen) {
      const t = setTimeout(() => titleRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [formOpen]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const setField = <K extends keyof MilestonePayload>(key: K, value: MilestonePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setFieldErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (m: Milestone) => {
    setEditId(m.id);
    setForm({
      title:       m.title,
      description: m.description,
      targetDate:  m.targetDate ? m.targetDate.slice(0, 10) : '',
      visionId:    m.visionId ?? '',
      completed:   m.completed,
      sortOrder:   m.sortOrder,
    });
    setFieldErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditId(null);
  };

  // Client-side validation (mirrors backend rules)
  function validate(f: MilestonePayload): MilestoneFieldErrors {
    const errs: MilestoneFieldErrors = {};
    if (!f.title.trim()) {
      errs.title = 'Please give this milestone a title.';
    } else if (f.title.trim().length > MAX_TITLE) {
      errs.title = `Keep the title under ${MAX_TITLE} characters.`;
    }
    if (f.description.trim().length > MAX_DESC) {
      errs.description = `Keep the description under ${MAX_DESC} characters.`;
    }
    if (f.targetDate && isNaN(new Date(f.targetDate).getTime())) {
      errs.targetDate = 'Enter a valid date.';
    }
    return errs;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setFieldErrors(found);
      return;
    }
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      if (editId) {
        const updated = await updateMilestone(token, editId, form);
        setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createMilestone(token, { ...form, sortOrder: milestones.length });
        setMilestones((prev) => [created, ...prev]);
      }
      closeForm();
    } catch (err) {
      setFieldErrors(readMilestoneFieldErrors(err));
      setFormError(readableError(err, "We couldn't save this milestone. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const updated = await toggleMilestoneComplete(token, id);
      setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setLoadError(readableError(err, "We couldn't update that milestone. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await deleteMilestoneApi(token, id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setLoadError(readableError(err, "We couldn't delete that milestone. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateCareerRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careerGoal.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerateError('');
    try {
      const created = await generateCareerMilestones(token, careerGoal);
      if (created.length === 0) {
        setGenerateError("The AI didn't return any milestones. Please try again.");
        return;
      }
      setMilestones((prev) => [...prev, ...created]);
      setCareerGoal('');
    } catch (err) {
      setGenerateError(readableError(err, "We couldn't generate a career roadmap right now. Please try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const sorted     = sortMilestones(milestones);
  const incomplete = sorted.filter((m) => !m.completed);
  const completed  = sorted.filter((m) => m.completed);
  const visionMap  = Object.fromEntries(visions.map((v) => [v.id, v.title]));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section
      aria-labelledby="roadmap-heading"
      className="space-y-6 border-t border-slate-200 pt-10"
    >
      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="roadmap-heading"
            className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em] text-slate-900"
          >
            <Flag className="h-5 w-5 text-blue-600" />
            Roadmap
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Break your visions down into milestones and track your path forward.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={isLoading}
          className="flex items-center gap-1.5 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95 disabled:opacity-60 sm:self-auto cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          Add Milestone
        </button>
      </div>

      {/* Career Roadmap generator */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">AI Career Roadmap</h3>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          Tell us your long-term career goal and the AI will lay out the major milestones to get there.
        </p>

        <form onSubmit={handleGenerateCareerRoadmap} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="sr-only" htmlFor="career-goal">
              Career Goal
            </label>
            <input
              id="career-goal"
              type="text"
              value={careerGoal}
              onChange={(e) => {
                setCareerGoal(e.target.value);
                if (generateError) setGenerateError('');
              }}
              disabled={isGenerating}
              placeholder="What is your ultimate career target? e.g. Full Stack Developer"
              maxLength={200}
              className={`${inputCls(!!generateError)} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating || !careerGoal.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Career Roadmap
              </>
            )}
          </button>
        </form>

        {generateError && <FieldError msg={generateError} />}
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-600">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </span>
          <button
            onClick={loadMilestones}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 font-semibold transition-colors hover:bg-rose-100 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Inline Add / Edit Form */}
      {formOpen && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              {editId ? 'Edit Milestone' : 'New Milestone'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form-level error */}
          {formError && (
            <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-600">
              {formError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Title */}
            <div>
              <label className={labelCls} htmlFor="ms-title">
                Milestone title <span className="text-rose-500">*</span>
              </label>
              <input
                id="ms-title"
                ref={titleRef}
                type="text"
                value={form.title}
                maxLength={MAX_TITLE}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. Complete the React course"
                className={inputCls(!!fieldErrors.title)}
                aria-invalid={!!fieldErrors.title}
              />
              <FieldError msg={fieldErrors.title} />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls} htmlFor="ms-desc">
                Description{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="ms-desc"
                value={form.description}
                rows={2}
                maxLength={MAX_DESC}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="What does completing this look like?"
                className={`${inputCls(!!fieldErrors.description)} resize-y`}
              />
              <FieldError msg={fieldErrors.description} />
            </div>

            {/* Target date + Vision link */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="ms-date">
                  Target date{' '}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ms-date"
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setField('targetDate', e.target.value)}
                  className={`${inputCls(!!fieldErrors.targetDate)} cursor-pointer`}
                />
                <FieldError msg={fieldErrors.targetDate} />
              </div>

              <div>
                <label className={labelCls} htmlFor="ms-vision">
                  Linked vision{' '}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select
                  id="ms-vision"
                  value={form.visionId}
                  onChange={(e) => setField('visionId', e.target.value)}
                  className={`${inputCls()} cursor-pointer`}
                >
                  <option value="">— none —</option>
                  {visions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title.length > 50 ? `${v.title.slice(0, 50)}…` : v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Completed checkbox */}
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.completed}
                onChange={(e) => setField('completed', e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              Mark as completed
            </label>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add milestone'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="mt-1 h-6 w-6 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && milestones.length === 0 && !formOpen && (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-white/70 p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-600/20">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No milestones yet</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
            Add your first milestone to start mapping the steps that take you from where you are to where you want to be.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Add Your First Milestone
          </button>
        </div>
      )}

      {/* Vertical timeline */}
      {!isLoading && milestones.length > 0 && (
        <div className="space-y-10">
          {/* ── Incomplete milestones ── */}
          {incomplete.length > 0 && (
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                In Progress · {incomplete.length}
              </p>
              <ol className="relative border-l-2 border-blue-100 pl-6 space-y-6">
                {incomplete.map((m) => (
                  <MilestoneNode
                    key={m.id}
                    milestone={m}
                    visionTitle={m.visionId ? visionMap[m.visionId] : undefined}
                    isBusy={busyId === m.id}
                    onToggle={handleToggleComplete}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </ol>
            </div>
          )}

          {/* ── Completed milestones ── */}
          {completed.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
              >
                {showCompleted ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Completed · {completed.length}
              </button>

              {showCompleted && (
                <ol className="relative border-l-2 border-emerald-100 pl-6 space-y-6">
                  {completed.map((m) => (
                    <MilestoneNode
                      key={m.id}
                      milestone={m}
                      visionTitle={m.visionId ? visionMap[m.visionId] : undefined}
                      isBusy={busyId === m.id}
                      onToggle={handleToggleComplete}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Milestone Node ───────────────────────────────────────────────────────────

interface NodeProps {
  milestone:   Milestone;
  visionTitle?: string;
  isBusy:      boolean;
  onToggle:    (id: string) => void;
  onEdit:      (m: Milestone) => void;
  onDelete:    (id: string) => void;
}

function MilestoneNode({ milestone: m, visionTitle, isBusy, onToggle, onEdit, onDelete }: NodeProps) {
  const target     = targetLabel(m.targetDate, m.completed);
  const isComplete = m.completed;

  return (
    <li className="relative">
      {/* Timeline dot */}
      <span
        className={`absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white transition-colors ${
          isComplete
            ? 'border-emerald-400 text-emerald-500'
            : 'border-blue-300 text-blue-500'
        }`}
        aria-hidden="true"
      >
        {isComplete ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Card */}
      <div
        className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${
          isComplete
            ? 'border-emerald-100 opacity-75'
            : 'border-slate-100 hover:border-blue-200 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <h4
              className={`text-sm font-semibold leading-snug ${
                isComplete
                  ? 'text-slate-500 line-through decoration-slate-300'
                  : 'text-slate-900'
              }`}
            >
              {m.title}
            </h4>

            {/* Linked vision pill */}
            {visionTitle && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <Flag className="h-2.5 w-2.5" />
                {visionTitle.length > 40
                  ? `${visionTitle.slice(0, 40)}…`
                  : visionTitle}
              </span>
            )}

            {/* Description */}
            {m.description && (
              <p
                className={`mt-2 text-xs leading-relaxed ${
                  isComplete ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {m.description}
              </p>
            )}

            {/* Target date */}
            {target.text && (
              <span
                className={`mt-2 inline-flex items-center gap-1 text-[11px] ${target.tone}`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {target.text}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggle(m.id)}
              disabled={isBusy}
              aria-label={isComplete ? 'Reopen milestone' : 'Mark as completed'}
              title={isComplete ? 'Reopen' : 'Mark as completed'}
              className={`rounded-lg p-1.5 text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                isComplete
                  ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isComplete ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onEdit(m)}
              disabled={isBusy}
              aria-label={`Edit ${m.title}`}
              title="Edit milestone"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer disabled:opacity-50"
            >
              {/* Pencil icon via inline SVG to avoid extra imports */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => onDelete(m.id)}
              disabled={isBusy}
              aria-label={`Delete ${m.title}`}
              title="Delete milestone"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Completed badge */}
        {isComplete && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600">Completed</span>
          </div>
        )}
      </div>
    </li>
  );
}
