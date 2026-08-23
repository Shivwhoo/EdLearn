'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  CircleDashed,
  FilterX,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import VisionCard from '@/components/VisionBoard/VisionCard';
import VisionFormModal from '@/components/VisionBoard/VisionFormModal';
import DeleteVisionDialog from '@/components/VisionBoard/DeleteVisionDialog';
import VisionRoadmapSection from '@/components/VisionBoard/VisionRoadmapSection';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  SORT_OPTIONS,
  Vision,
  VisionFieldErrors,
  VisionPayload,
  VisionSort,
  VisionStats,
  VISION_CATEGORIES,
  createVision,
  deleteVision,
  fetchVisionBoard,
  filterAndSortVisions,
  getAuthToken,
  readFieldErrors,
  readableError,
  updateVision,
  updateVisionStatus,
} from '@/lib/visionBoard';

/**
 * <VisionBoardModal /> — the student's private board of learning, career and
 * personal goals, as a popup rather than a dedicated /vision-board page.
 * Reusable: drop it anywhere with `isOpen` + `onClose` (Sidebar and the
 * Dashboard reminder banner each mount their own instance/state — see those
 * files). All data-fetching only kicks in once `isOpen` is true, so mounting
 * this component ahead of time (e.g. always rendered by Sidebar) costs
 * nothing until the user actually opens it.
 */

interface VisionBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_STATS: VisionStats = {
  total: 0,
  notStarted: 0,
  inProgress: 0,
  achieved: 0,
  progressPercent: 0,
};

/** Small burst reusing the confetti library already bundled for badges. */
function celebrate() {
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.7 },
    colors: ['#10B981', '#2563EB', '#F59E0B', '#8B5CF6'],
  });
}

function StatCard({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md cursor-pointer ${
        active ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-100 hover:border-blue-200'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xl font-extrabold tabular-nums leading-none text-slate-900">{value}</span>
        <span className="mt-1 block truncate text-[11px] font-medium text-slate-500">{label}</span>
      </span>
    </button>
  );
}

/** Card-shaped skeletons so the grid doesn't collapse while loading. */
function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="h-40 animate-pulse bg-slate-100" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VisionBoardModal({ isOpen, onClose }: VisionBoardModalProps) {
  const router = useRouter();
  const { token, user, logout } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [visions, setVisions] = useState<Vision[]>([]);
  const [stats, setStats] = useState<VisionStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters / sorting / search
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [sort, setSort] = useState<VisionSort>('newest');
  const [search, setSearch] = useState('');

  // Add/Edit form + delete confirmation + per-card busy state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vision | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState<VisionFieldErrors>({});
  const [pendingDelete, setPendingDelete] = useState<Vision | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const authToken = isMounted ? getAuthToken(token) : null;

  // Auto-dismiss the success banner.
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(''), 3500);
    return () => clearTimeout(timer);
  }, [successMsg]);

  /** A dead session should log out cleanly rather than showing an error. */
  const handleAuthFailure = useCallback(() => {
    logout();
    if (typeof window !== 'undefined') localStorage.removeItem('edlearn_token');
    onClose();
    router.push('/login');
  }, [logout, onClose, router]);

  const loadBoard = useCallback(
    async (tokenValue: string) => {
      setIsLoading(true);
      setLoadError('');
      try {
        const { visions: rows, stats: nextStats } = await fetchVisionBoard(tokenValue);
        setVisions(rows);
        setStats(nextStats ?? EMPTY_STATS);
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          (err as { response?: { status?: number } }).response?.status === 401
        ) {
          handleAuthFailure();
          return;
        }
        setLoadError(readableError(err, "We couldn't load your vision board just now."));
      } finally {
        setIsLoading(false);
      }
    },
    [handleAuthFailure]
  );

  // Fetch fresh data every time the modal opens — not on mount, since a
  // Sidebar-owned instance stays mounted (closed) on every page.
  useEffect(() => {
    if (!isOpen || !isMounted || !authToken) return;
    loadBoard(authToken);
  }, [isOpen, isMounted, authToken, loadBoard]);

  // Escape to close (only when no nested modal is capturing it) + body scroll lock.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !formOpen && !pendingDelete) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, formOpen, pendingDelete, onClose]);

  const visibleVisions = useMemo(
    () => filterAndSortVisions(visions, { category, status, search, sort }),
    [visions, category, status, search, sort]
  );

  const filtersActive = category !== 'all' || status !== 'all' || search.trim() !== '';

  const resetFilters = () => {
    setCategory('all');
    setStatus('all');
    setSearch('');
  };

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setFormFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (vision: Vision) => {
    setEditing(vision);
    setFormError('');
    setFormFieldErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (payload: VisionPayload) => {
    if (!authToken) return;
    setSaving(true);
    setFormError('');
    setFormFieldErrors({});
    try {
      if (editing) {
        const { vision, stats: nextStats } = await updateVision(authToken, editing.id, payload);
        setVisions((prev) => prev.map((v) => (v.id === vision.id ? vision : v)));
        setStats(nextStats ?? EMPTY_STATS);
        setSuccessMsg('Vision updated.');
        if (vision.status === 'achieved' && editing.status !== 'achieved') celebrate();
      } else {
        const { vision, stats: nextStats } = await createVision(authToken, payload);
        setVisions((prev) => [vision, ...prev]);
        setStats(nextStats ?? EMPTY_STATS);
        setSuccessMsg('Vision added to your board.');
        if (vision.status === 'achieved') celebrate();
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setFormFieldErrors(readFieldErrors(err));
      setFormError(readableError(err, "We couldn't save your vision. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAchieved = async (vision: Vision) => {
    if (!authToken || busyId) return;
    const nextStatus = vision.status === 'achieved' ? 'in_progress' : 'achieved';
    setBusyId(vision.id);
    setLoadError('');
    try {
      const { vision: updated, stats: nextStats } = await updateVisionStatus(
        authToken,
        vision.id,
        nextStatus
      );
      setVisions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setStats(nextStats ?? EMPTY_STATS);
      if (nextStatus === 'achieved') {
        celebrate();
        setSuccessMsg(`🎉 "${updated.title}" marked as achieved!`);
      } else {
        setSuccessMsg('Vision moved back to In Progress.');
      }
    } catch (err) {
      setLoadError(readableError(err, "We couldn't update that vision. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!authToken || !pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { stats: nextStats } = await deleteVision(authToken, pendingDelete.id);
      setVisions((prev) => prev.filter((v) => v.id !== pendingDelete.id));
      setStats(nextStats ?? EMPTY_STATS);
      setPendingDelete(null);
      setSuccessMsg('Vision deleted.');
    } catch (err) {
      setDeleteError(readableError(err, "We couldn't delete that vision. Please try again."));
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Plain Fragment, not a wrapping div: VisionFormModal/DeleteVisionDialog
    // below must be DOM *siblings* of the backdrop, not descendants of it.
    // They're each their own `fixed inset-0` overlay with their own
    // click-outside-to-close handler that doesn't stopPropagation on its own
    // backdrop click (by design, in those components) — if they were nested
    // inside this backdrop div, clicking their backdrop would bubble up and
    // trigger THIS modal's onClose too, closing the whole board by accident.
    <>
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 py-8 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-board-modal-heading"
    >
      <div
        className="animate-scale-in relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky so it stays visible while the board scrolls beneath it */}
        <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-white/90 p-6 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              id="vision-board-modal-heading"
              className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] text-slate-900"
            >
              <Sparkles className="h-5.5 w-5.5 text-blue-600" />
              My Vision Board
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Everything you&apos;re working towards, in one place
              {user?.fullName ? `, ${user.fullName}` : ''}. Picture it, then go get it.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4.5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Vision</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close Vision Board"
              className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="relative flex-1 overflow-y-auto p-6 md:p-8">
          <div className="pointer-events-none absolute left-10 top-0 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-10 right-10 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-6xl space-y-8">
            {/* Feedback banners */}
            {successMsg && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {successMsg}
                </span>
                <button
                  onClick={() => setSuccessMsg('')}
                  aria-label="Dismiss"
                  className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {loadError && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-600">
                <span>{loadError}</span>
                <button
                  onClick={() => authToken && loadBoard(authToken)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 font-semibold transition-colors hover:bg-rose-100 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}

            {/* Statistics + overall progress */}
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard
                  label="Total Visions"
                  value={stats.total}
                  icon={<Target className="h-4.5 w-4.5" />}
                  tone="bg-blue-50 text-blue-600"
                  active={status === 'all'}
                  onClick={() => setStatus('all')}
                />
                <StatCard
                  label="In Progress"
                  value={stats.inProgress}
                  icon={<Loader2 className="h-4.5 w-4.5" />}
                  tone="bg-sky-50 text-sky-600"
                  active={status === 'in_progress'}
                  onClick={() => setStatus(status === 'in_progress' ? 'all' : 'in_progress')}
                />
                <StatCard
                  label="Achieved"
                  value={stats.achieved}
                  icon={<Trophy className="h-4.5 w-4.5" />}
                  tone="bg-emerald-50 text-emerald-600"
                  active={status === 'achieved'}
                  onClick={() => setStatus(status === 'achieved' ? 'all' : 'achieved')}
                />
                <StatCard
                  label="Not Started"
                  value={stats.notStarted}
                  icon={<CircleDashed className="h-4.5 w-4.5" />}
                  tone="bg-slate-100 text-slate-500"
                  active={status === 'not_started'}
                  onClick={() => setStatus(status === 'not_started' ? 'all' : 'not_started')}
                />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">Vision Board Progress</h2>
                  <span className="text-sm font-extrabold tabular-nums text-blue-600">
                    {stats.progressPercent}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.max(stats.progressPercent, stats.total > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
                  Achieved visions count in full; in-progress ones count partially. Keep moving and this climbs.
                </p>
              </div>
            </section>

            {/* Filters, sort and search */}
            <section className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCategory('all')}
                    className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                      category === 'all'
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    All
                  </button>
                  {VISION_CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setCategory(category === c.key ? 'all' : c.key)}
                      className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                        category === c.key
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      <span aria-hidden="true">{c.emoji}</span> {c.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search visions..."
                      aria-label="Search visions"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-52"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as VisionSort)}
                    aria-label="Sort visions"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        Sort: {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filtersActive && !isLoading && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>
                    Showing {visibleVisions.length} of {visions.length} vision
                    {visions.length === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer"
                  >
                    <FilterX className="h-3.5 w-3.5" />
                    Clear filters
                  </button>
                </div>
              )}
            </section>

            {/* Board */}
            {isLoading ? (
              <BoardSkeleton />
            ) : visions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-200 bg-white/70 p-10 text-center shadow-sm md:p-16">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/20">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-900">
                  Your vision board is waiting for your dreams ✨
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                  Add your first goal and start building the future you want.
                </p>
                <button
                  onClick={openCreate}
                  className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold tracking-[0.01em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Your First Vision
                </button>
              </div>
            ) : visibleVisions.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">No visions match those filters</h2>
                <p className="mt-1.5 text-xs text-slate-500">
                  Try a different category, status or search term.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleVisions.map((vision) => (
                  <VisionCard
                    key={vision.id}
                    vision={vision}
                    isBusy={busyId === vision.id}
                    onEdit={openEdit}
                    onDelete={(v) => {
                      setDeleteError('');
                      setPendingDelete(v);
                    }}
                    onToggleAchieved={handleToggleAchieved}
                  />
                ))}
              </div>
            )}

            {/* Roadmap — milestones persisted in the database, not in localStorage.
                Vision Board is goal/milestone-tracking only; AI roadmap
                generation lives on its own dedicated page (see /roadmap). */}
            {authToken && <VisionRoadmapSection visions={visions} token={authToken} />}
          </div>
        </div>
      </div>
    </div>

    {/* Nested modals — rendered as siblings of the backdrop above (not
        descendants — see the Fragment comment up top), and each already
        uses a higher z-index (z-50 / z-[60]) than this modal's z-40, so they
        correctly layer on top. */}
    <VisionFormModal
      open={formOpen}
      vision={editing}
      saving={saving}
      serverError={formError}
      serverFieldErrors={formFieldErrors}
      onClose={() => {
        if (saving) return;
        setFormOpen(false);
        setEditing(null);
      }}
      onSubmit={handleSubmit}
    />

    <DeleteVisionDialog
      vision={pendingDelete}
      deleting={deleting}
      error={deleteError}
      onCancel={() => {
        if (deleting) return;
        setPendingDelete(null);
        setDeleteError('');
      }}
      onConfirm={handleDelete}
    />
    </>
  );
}
