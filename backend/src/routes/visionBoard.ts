import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Rate limit: 120 requests per 15 minutes per IP (authenticated, interactive route)
const visionBoardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the vision board API. Please slow down.' },
});


/**
 * Vision Board API — a student's private board of learning/career goals.
 *
 * SECURITY: this router is mounted behind the `authenticate` middleware in
 * index.ts, so `req.user.id` is always a verified user. Every query below is
 * scoped to that id and the client-supplied body is NEVER allowed to carry a
 * `userId` — that means a user cannot read, update or delete another user's
 * vision even if they know its UUID (those requests get a plain 404).
 *
 * Routes (all relative to /api/vision-board):
 *   GET    /              -> list the caller's visions + computed stats
 *   GET    /:id           -> a single vision owned by the caller
 *   POST   /              -> create
 *   PUT    /:id           -> full update
 *   PATCH  /:id/status    -> status-only update (used by "Mark as Achieved")
 *   DELETE /:id           -> delete
 */

const router = Router();

router.use(visionBoardLimiter);

export const VISION_CATEGORIES = [
  'education',
  'career',
  'skills',
  'achievements',
  'growth',
  'projects',
  'other',
] as const;

export const VISION_STATUSES = ['not_started', 'in_progress', 'achieved'] as const;

// Fields the client is allowed to send. Anything else (userId, id, createdAt…)
// is ignored by construction — we only ever read these keys off the body.
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_QUOTE = 240;
const MAX_URL = 2048;
// Inline data URLs are downscaled client-side before upload. 600k characters of
// base64 (~440KB of image data) is a generous ceiling that still leaves room
// under the global 1mb express.json() body limit.
const MAX_IMAGE_URL = 600_000;

interface VisionInput {
  title: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  targetDate: Date | null;
  quote: string | null;
  resourceUrl: string | null;
  status: string;
}

/** Trim a value to a string, or return null for empty/absent values. */
function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Accepts an https/http image link or a compact inline image data URL. */
function isAllowedImageSource(value: string): boolean {
  if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(value)) {
    return true;
  }
  return isHttpUrl(value);
}

/**
 * Validates and normalizes a create/update payload.
 * Returns either field-level errors (for a 400) or the clean data to persist.
 */
function validateVisionPayload(
  body: any,
  { partial }: { partial: boolean } = { partial: false }
): { errors: Record<string, string> } | { data: VisionInput } {
  const errors: Record<string, string> = {};

  const title = optionalString(body?.title);
  if (!title) {
    errors.title = 'Please give your vision a title.';
  } else if (title.length > MAX_TITLE) {
    errors.title = `Title must be ${MAX_TITLE} characters or fewer.`;
  }

  const description = optionalString(body?.description);
  if (description && description.length > MAX_DESCRIPTION) {
    errors.description = `Description must be ${MAX_DESCRIPTION} characters or fewer.`;
  }

  const rawCategory = optionalString(body?.category)?.toLowerCase() ?? 'other';
  if (!(VISION_CATEGORIES as readonly string[]).includes(rawCategory)) {
    errors.category = 'Please choose one of the available categories.';
  }

  const rawStatus = optionalString(body?.status)?.toLowerCase() ?? 'not_started';
  if (!(VISION_STATUSES as readonly string[]).includes(rawStatus)) {
    errors.status = 'Please choose one of the available statuses.';
  }

  const imageUrl = optionalString(body?.imageUrl);
  if (imageUrl) {
    if (imageUrl.length > MAX_IMAGE_URL) {
      errors.imageUrl = 'That image is too large — please pick one under 400KB.';
    } else if (!isAllowedImageSource(imageUrl)) {
      errors.imageUrl = 'Enter a valid image link starting with https:// or upload a file.';
    }
  }

  const resourceUrl = optionalString(body?.resourceUrl);
  if (resourceUrl) {
    if (resourceUrl.length > MAX_URL) {
      errors.resourceUrl = 'That link is too long.';
    } else if (!isHttpUrl(resourceUrl)) {
      errors.resourceUrl = 'Enter a valid link starting with https://';
    }
  }

  const quote = optionalString(body?.quote);
  if (quote && quote.length > MAX_QUOTE) {
    errors.quote = `Quote must be ${MAX_QUOTE} characters or fewer.`;
  }

  let targetDate: Date | null = null;
  const rawTargetDate = optionalString(body?.targetDate);
  if (rawTargetDate) {
    const parsed = new Date(rawTargetDate);
    if (Number.isNaN(parsed.getTime())) {
      errors.targetDate = 'Enter a valid target date.';
    } else {
      targetDate = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      title: title as string,
      description,
      category: rawCategory,
      imageUrl,
      targetDate,
      quote,
      resourceUrl,
      status: rawStatus,
    },
  };
}

/**
 * Board statistics, computed from the caller's own rows so the UI and the
 * database can never disagree.
 *
 * Overall progress weights an achieved vision as 1 and an in-progress vision
 * as 1/3, so simply starting something moves the needle a little while only
 * finishing it counts fully.
 */
async function buildStats(userId: string) {
  const grouped = await db.vision.groupBy({
    by: ['status'],
    where: { userId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = { not_started: 0, in_progress: 0, achieved: 0 };
  for (const row of grouped) {
    if (row.status in counts) counts[row.status] = row._count._all;
  }

  const total = counts.not_started + counts.in_progress + counts.achieved;
  const progressPercent =
    total === 0 ? 0 : Math.round(((counts.achieved + counts.in_progress / 3) / total) * 100);

  return {
    total,
    notStarted: counts.not_started,
    inProgress: counts.in_progress,
    achieved: counts.achieved,
    progressPercent,
  };
}

/** GET /api/vision-board — every vision belonging to the caller, plus stats. */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const [visions, stats] = await Promise.all([
      db.vision.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      buildStats(userId),
    ]);
    return res.json({ success: true, visions, stats });
  } catch (error) {
    console.error('[api/vision-board] List error:', error);
    return res.status(500).json({ error: 'Could not load your vision board. Please try again.' });
  }
});

/** GET /api/vision-board/:id — a single vision, only if the caller owns it. */
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const vision = await db.vision.findFirst({ where: { id: String(req.params.id), userId } });
    if (!vision) {
      return res.status(404).json({ error: 'Vision not found.' });
    }
    return res.json({ success: true, vision });
  } catch (error) {
    console.error('[api/vision-board] Fetch error:', error);
    return res.status(500).json({ error: 'Could not load that vision. Please try again.' });
  }
});

/** POST /api/vision-board — create a vision owned by the caller. */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = validateVisionPayload(req.body);
  if ('errors' in result) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: result.errors });
  }

  try {
    const vision = await db.vision.create({
      data: {
        ...result.data,
        // Ownership comes from the verified JWT, never from the request body.
        userId,
        achievedAt: result.data.status === 'achieved' ? new Date() : null,
      },
    });
    const stats = await buildStats(userId);
    return res.status(201).json({ success: true, vision, stats });
  } catch (error) {
    console.error('[api/vision-board] Create error:', error);
    return res.status(500).json({ error: 'Could not save your vision. Please try again.' });
  }
});

/** PUT /api/vision-board/:id — full update of a vision the caller owns. */
router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = validateVisionPayload(req.body);
  if ('errors' in result) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: result.errors });
  }

  try {
    const existing = await db.vision.findFirst({
      where: { id: String(req.params.id), userId },
      select: { id: true, status: true, achievedAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Vision not found.' });
    }

    const becameAchieved = result.data.status === 'achieved';
    const vision = await db.vision.update({
      where: { id: existing.id },
      data: {
        ...result.data,
        achievedAt: becameAchieved ? existing.achievedAt ?? new Date() : null,
      },
    });
    const stats = await buildStats(userId);
    return res.json({ success: true, vision, stats });
  } catch (error) {
    console.error('[api/vision-board] Update error:', error);
    return res.status(500).json({ error: 'Could not update your vision. Please try again.' });
  }
});

/**
 * PATCH /api/vision-board/:id/status — status-only transition.
 * Powers the "Mark as Achieved" card action without round-tripping the whole form.
 */
router.patch('/:id/status', async (req: Request<{ id: string }>, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const status = optionalString(req.body?.status)?.toLowerCase();

  if (!status || !(VISION_STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({
      error: 'Please choose one of the available statuses.',
      fields: { status: 'Invalid status.' },
    });
  }

  try {
    const existing = await db.vision.findFirst({
      where: { id: String(req.params.id), userId },
      select: { id: true, achievedAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Vision not found.' });
    }

    const vision = await db.vision.update({
      where: { id: existing.id },
      data: {
        status,
        achievedAt: status === 'achieved' ? existing.achievedAt ?? new Date() : null,
      },
    });
    const stats = await buildStats(userId);
    return res.json({ success: true, vision, stats });
  } catch (error) {
    console.error('[api/vision-board] Status update error:', error);
    return res.status(500).json({ error: 'Could not update that vision. Please try again.' });
  }
});

/** DELETE /api/vision-board/:id — delete a vision the caller owns. */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    // deleteMany scoped by userId is atomic: a foreign id simply matches 0 rows.
    const deleted = await db.vision.deleteMany({ where: { id: String(req.params.id), userId } });
    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Vision not found.' });
    }
    const stats = await buildStats(userId);
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('[api/vision-board] Delete error:', error);
    return res.status(500).json({ error: 'Could not delete that vision. Please try again.' });
  }
});

export default router;
