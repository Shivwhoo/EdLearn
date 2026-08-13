import axios from 'axios';

/**
 * Vision Board data layer — types, display metadata and the thin axios wrapper
 * used by /vision-board.
 *
 * Requests go to the relative "/api/vision-board" path, which next.config.ts
 * rewrites to the Express backend, and carry the same `edlearn_token` bearer
 * header the rest of the authenticated app uses (see workspaceStore).
 */

export type VisionCategory =
  | 'education'
  | 'career'
  | 'skills'
  | 'achievements'
  | 'growth'
  | 'projects'
  | 'other';

export type VisionStatus = 'not_started' | 'in_progress' | 'achieved';

export interface Vision {
  id: string;
  title: string;
  description: string | null;
  category: VisionCategory;
  imageUrl: string | null;
  targetDate: string | null;
  quote: string | null;
  resourceUrl: string | null;
  status: VisionStatus;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisionStats {
  total: number;
  notStarted: number;
  inProgress: number;
  achieved: number;
  progressPercent: number;
}

/** The shape the form collects and the API accepts. */
export interface VisionPayload {
  title: string;
  description: string;
  category: VisionCategory;
  imageUrl: string;
  targetDate: string;
  quote: string;
  resourceUrl: string;
  status: VisionStatus;
}

/** Field-level validation errors returned by the backend on a 400. */
export type VisionFieldErrors = Partial<Record<keyof VisionPayload, string>>;

// --- Display metadata -------------------------------------------------------
// Colour families mirror the badges already used across the dashboard, news
// and books pages so the board doesn't introduce a new palette.

export const VISION_CATEGORIES: {
  key: VisionCategory;
  label: string;
  emoji: string;
  badge: string;
  gradient: string;
}[] = [
  {
    key: 'education',
    label: 'Education',
    emoji: '🎓',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    key: 'career',
    label: 'Career',
    emoji: '💼',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    gradient: 'from-indigo-500 to-violet-600',
  },
  {
    key: 'skills',
    label: 'Skills',
    emoji: '💻',
    badge: 'bg-sky-50 text-sky-700 border-sky-100',
    gradient: 'from-sky-500 to-blue-600',
  },
  {
    key: 'achievements',
    label: 'Achievements',
    emoji: '🏆',
    badge: 'bg-amber-50 text-amber-700 border-amber-100',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    key: 'growth',
    label: 'Personal Growth',
    emoji: '🌱',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    key: 'projects',
    label: 'Projects',
    emoji: '💡',
    badge: 'bg-violet-50 text-violet-700 border-violet-100',
    gradient: 'from-violet-500 to-fuchsia-600',
  },
  {
    key: 'other',
    label: 'Other',
    emoji: '⭐',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    gradient: 'from-slate-500 to-slate-700',
  },
];

export const VISION_STATUSES: {
  key: VisionStatus;
  label: string;
  badge: string;
  dot: string;
}[] = [
  {
    key: 'not_started',
    label: 'Not Started',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    dot: 'bg-blue-500',
  },
  {
    key: 'achieved',
    label: 'Achieved',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dot: 'bg-emerald-500',
  },
];

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'target', label: 'Target Date' },
  { key: 'status', label: 'Status' },
] as const;

export type VisionSort = (typeof SORT_OPTIONS)[number]['key'];

export const categoryMeta = (key: string) =>
  VISION_CATEGORIES.find((c) => c.key === key) ?? VISION_CATEGORIES[VISION_CATEGORIES.length - 1];

export const statusMeta = (key: string) =>
  VISION_STATUSES.find((s) => s.key === key) ?? VISION_STATUSES[0];

export const emptyVisionPayload = (): VisionPayload => ({
  title: '',
  description: '',
  category: 'education',
  imageUrl: '',
  targetDate: '',
  quote: '',
  resourceUrl: '',
  status: 'not_started',
});

/** Turn an existing vision into form state (dates trimmed to yyyy-mm-dd). */
export const visionToPayload = (vision: Vision): VisionPayload => ({
  title: vision.title,
  description: vision.description ?? '',
  category: vision.category,
  imageUrl: vision.imageUrl ?? '',
  targetDate: vision.targetDate ? vision.targetDate.slice(0, 10) : '',
  quote: vision.quote ?? '',
  resourceUrl: vision.resourceUrl ?? '',
  status: vision.status,
});

// --- Client-side filtering / sorting ---------------------------------------
// The board is a small, per-user collection, so it's fetched once and filtered
// in memory. That keeps filter/sort/search instant with no extra round trips.

const STATUS_ORDER: Record<VisionStatus, number> = {
  in_progress: 0,
  not_started: 1,
  achieved: 2,
};

export function filterAndSortVisions(
  visions: Vision[],
  { category, status, search, sort }: {
    category: string;
    status: string;
    search: string;
    sort: VisionSort;
  }
): Vision[] {
  const query = search.trim().toLowerCase();

  const filtered = visions.filter((v) => {
    if (category !== 'all' && v.category !== category) return false;
    if (status !== 'all' && v.status !== status) return false;
    if (query) {
      const haystack = [v.title, v.description, v.quote].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'target': {
        // Visions without a target date sort last rather than jumping to the top.
        const aTime = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
        const bTime = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
        return aTime - bTime;
      }
      case 'status':
        return (
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return sorted;
}

// --- Image helper ----------------------------------------------------------

const MAX_IMAGE_EDGE = 900;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * EdLearn has no file-storage backend, so an uploaded picture is downscaled in
 * the browser with a canvas and stored as a compact JPEG data URL on the
 * Vision row. Typical output is 60–150KB, comfortably inside the API's 1mb
 * body limit — and no new dependency or paid service is needed. Users who
 * prefer a hosted image can still paste a URL instead.
 */
export function fileToDownscaledDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG, JPG, WEBP or GIF).'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('That image is over 8MB — please choose a smaller one.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We couldn't read that file. Please try another image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Your browser couldn't process that image. Try pasting an image URL."));
          return;
        }
        // Flatten onto white so transparent PNGs don't turn black as JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// --- API calls -------------------------------------------------------------

const BASE = '/api/vision-board';

/** Mirrors the dashboard's helper: store token first, localStorage fallback. */
export function getAuthToken(storeToken?: string | null): string | null {
  if (typeof window === 'undefined') return storeToken ?? null;
  return storeToken || localStorage.getItem('edlearn_token');
}

const authHeaders = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Only send what the API accepts; empty strings become nulls server-side. */
const serialize = (payload: VisionPayload) => ({
  title: payload.title.trim(),
  description: payload.description.trim(),
  category: payload.category,
  imageUrl: payload.imageUrl.trim(),
  targetDate: payload.targetDate,
  quote: payload.quote.trim(),
  resourceUrl: payload.resourceUrl.trim(),
  status: payload.status,
});

export async function fetchVisionBoard(token: string) {
  const res = await axios.get(BASE, authHeaders(token));
  return {
    visions: (res.data?.visions || []) as Vision[],
    stats: res.data?.stats as VisionStats,
  };
}

export async function createVision(token: string, payload: VisionPayload) {
  const res = await axios.post(BASE, serialize(payload), authHeaders(token));
  return { vision: res.data?.vision as Vision, stats: res.data?.stats as VisionStats };
}

export async function updateVision(token: string, id: string, payload: VisionPayload) {
  const res = await axios.put(`${BASE}/${id}`, serialize(payload), authHeaders(token));
  return { vision: res.data?.vision as Vision, stats: res.data?.stats as VisionStats };
}

export async function updateVisionStatus(token: string, id: string, status: VisionStatus) {
  const res = await axios.patch(`${BASE}/${id}/status`, { status }, authHeaders(token));
  return { vision: res.data?.vision as Vision, stats: res.data?.stats as VisionStats };
}

export async function deleteVision(token: string, id: string) {
  const res = await axios.delete(`${BASE}/${id}`, authHeaders(token));
  return { stats: res.data?.stats as VisionStats };
}

/**
 * Never surface a raw axios/stack message. Prefers the backend's friendly
 * `error` string and falls back to a generic line.
 */
export function readableError(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

/** Field errors from a 400 response, if the backend supplied any. */
export function readFieldErrors(err: unknown): VisionFieldErrors {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { fields?: VisionFieldErrors } | undefined;
    if (data?.fields) return data.fields;
  }
  return {};
}

// ─── Milestones ────────────────────────────────────────────────────────────
// Backed by /api/vision-milestones — stored in the database, NOT localStorage.

const MILESTONE_BASE = '/api/vision-milestones';

/** Shape returned by the API for a single milestone. */
export interface Milestone {
  id:          string;
  userId:      string;
  visionId:    string | null;
  title:       string;
  description: string;
  targetDate:  string | null;   // ISO date string or null
  sortOrder:   number;
  completed:   boolean;
  createdAt:   string;
  updatedAt:   string;
}

/** Shape the form collects and sends to the API. */
export interface MilestonePayload {
  title:       string;
  description: string;
  targetDate:  string;          // yyyy-mm-dd or empty string
  visionId:    string;          // empty string = no linked vision
  completed:   boolean;
  sortOrder:   number;
}

/** Field-level errors the backend may return on a 400 for milestones. */
export type MilestoneFieldErrors = Partial<Record<keyof MilestonePayload, string>>;

const serializeMilestone = (p: MilestonePayload) => ({
  title:       p.title.trim(),
  description: p.description.trim(),
  targetDate:  p.targetDate || null,
  visionId:    p.visionId   || null,
  completed:   p.completed,
  sortOrder:   p.sortOrder,
});

/** GET /api/vision-milestones — all milestones for the current user. */
export async function fetchMilestones(token: string): Promise<Milestone[]> {
  const res = await axios.get(MILESTONE_BASE, authHeaders(token));
  return (res.data?.milestones ?? []) as Milestone[];
}

/** POST /api/vision-milestones — create a new milestone. */
export async function createMilestone(token: string, payload: MilestonePayload): Promise<Milestone> {
  const res = await axios.post(MILESTONE_BASE, serializeMilestone(payload), authHeaders(token));
  return res.data?.milestone as Milestone;
}

/** PUT /api/vision-milestones/:id — full update. */
export async function updateMilestone(token: string, id: string, payload: MilestonePayload): Promise<Milestone> {
  const res = await axios.put(`${MILESTONE_BASE}/${id}`, serializeMilestone(payload), authHeaders(token));
  return res.data?.milestone as Milestone;
}

/** PATCH /api/vision-milestones/:id/complete — toggle completed flag. */
export async function toggleMilestoneComplete(token: string, id: string): Promise<Milestone> {
  const res = await axios.patch(`${MILESTONE_BASE}/${id}/complete`, {}, authHeaders(token));
  return res.data?.milestone as Milestone;
}

/** DELETE /api/vision-milestones/:id */
export async function deleteMilestoneApi(token: string, id: string): Promise<void> {
  await axios.delete(`${MILESTONE_BASE}/${id}`, authHeaders(token));
}

/** Field errors from a 400 milestone response. */
export function readMilestoneFieldErrors(err: unknown): MilestoneFieldErrors {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { fields?: MilestoneFieldErrors } | undefined;
    if (data?.fields) return data.fields;
  }
  return {};
}
