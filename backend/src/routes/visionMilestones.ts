import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Vision Milestones API — database-backed roadmap steps tied to a user's
 * Vision Board. Every route is mounted behind `authenticate` in index.ts,
 * so `req.user.id` is always a verified user. All queries are scoped to that
 * id — clients can never read, update or delete another user's milestones.
 *
 * Routes (all relative to /api/vision-milestones):
 *   GET    /              → list all milestones belonging to the caller
 *   POST   /              → create a milestone
 *   PUT    /:id           → full update
 *   PATCH  /:id/complete  → toggle completed flag
 *   DELETE /:id           → delete
 */

const router = Router();

const MAX_TITLE = 120;
const MAX_DESC  = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function optStr(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

interface MilestoneInput {
  visionId:    string | null;
  title:       string;
  description: string;
  targetDate:  Date | null;
  sortOrder:   number;
  completed:   boolean;
}

/**
 * Validates and normalises a create/update body.
 * Returns { errors } on bad input or { data } on success.
 */
function validatePayload(body: any): { errors: Record<string, string> } | { data: MilestoneInput } {
  const errors: Record<string, string> = {};

  const title = optStr(body?.title);
  if (!title) {
    errors.title = 'Please give this milestone a title.';
  } else if (title.length > MAX_TITLE) {
    errors.title = `Title must be ${MAX_TITLE} characters or fewer.`;
  }

  const description = optStr(body?.description) ?? '';
  if (description.length > MAX_DESC) {
    errors.description = `Description must be ${MAX_DESC} characters or fewer.`;
  }

  let targetDate: Date | null = null;
  const rawDate = optStr(body?.targetDate);
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      errors.targetDate = 'Enter a valid date.';
    } else {
      targetDate = parsed;
    }
  }

  const visionId = optStr(body?.visionId);

  const rawOrder = body?.sortOrder;
  const sortOrder =
    typeof rawOrder === 'number' && Number.isFinite(rawOrder)
      ? Math.round(rawOrder)
      : 0;

  const completed = body?.completed === true;

  if (Object.keys(errors).length > 0) return { errors };

  return {
    data: {
      visionId,
      title:       title as string,
      description,
      targetDate,
      sortOrder,
      completed,
    },
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /api/vision-milestones — all milestones for the caller, sorted. */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const milestones = await db.visionMilestone.findMany({
      where:   { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return res.json({ success: true, milestones });
  } catch (error) {
    console.error('[api/vision-milestones] List error:', error);
    return res.status(500).json({ error: 'Could not load your milestones. Please try again.' });
  }
});

/** POST /api/vision-milestones — create a milestone owned by the caller. */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = validatePayload(req.body);
  if ('errors' in result) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: result.errors });
  }

  try {
    // If a visionId is supplied, verify it belongs to this user.
    if (result.data.visionId) {
      const owns = await db.vision.findFirst({ where: { id: result.data.visionId, userId } });
      if (!owns) {
        return res.status(400).json({ error: 'Vision not found.', fields: { visionId: 'Select one of your own visions.' } });
      }
    }

    const milestone = await db.visionMilestone.create({
      data: { ...result.data, userId },
    });
    return res.status(201).json({ success: true, milestone });
  } catch (error) {
    console.error('[api/vision-milestones] Create error:', error);
    return res.status(500).json({ error: 'Could not save the milestone. Please try again.' });
  }
});

/** PUT /api/vision-milestones/:id — full update of a milestone the caller owns. */
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = validatePayload(req.body);
  if ('errors' in result) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: result.errors });
  }

  try {
    const existing = await db.visionMilestone.findFirst({ where: { id: req.params.id as string, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    if (result.data.visionId) {
      const owns = await db.vision.findFirst({ where: { id: result.data.visionId, userId } });
      if (!owns) {
        return res.status(400).json({ error: 'Vision not found.', fields: { visionId: 'Select one of your own visions.' } });
      }
    }

    const milestone = await db.visionMilestone.update({
      where: { id: existing.id },
      data:  result.data,
    });
    return res.json({ success: true, milestone });
  } catch (error) {
    console.error('[api/vision-milestones] Update error:', error);
    return res.status(500).json({ error: 'Could not update the milestone. Please try again.' });
  }
});

/**
 * PATCH /api/vision-milestones/:id/complete — toggle the completed flag.
 * Powers the checkmark button on each milestone node without a full form round-trip.
 */
router.patch('/:id/complete', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const existing = await db.visionMilestone.findFirst({ where: { id: req.params.id as string, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }
    const milestone = await db.visionMilestone.update({
      where: { id: existing.id },
      data:  { completed: !existing.completed },
    });
    return res.json({ success: true, milestone });
  } catch (error) {
    console.error('[api/vision-milestones] Toggle error:', error);
    return res.status(500).json({ error: 'Could not update the milestone. Please try again.' });
  }
});

/** DELETE /api/vision-milestones/:id — delete a milestone the caller owns. */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const deleted = await db.visionMilestone.deleteMany({ where: { id: req.params.id as string, userId } });
    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[api/vision-milestones] Delete error:', error);
    return res.status(500).json({ error: 'Could not delete the milestone. Please try again.' });
  }
});

export default router;
