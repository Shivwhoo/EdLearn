import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiService } from '../lib/ai/aiService';

/**
 * Vision Milestones API — database-backed roadmap steps tied to a user's
 * Vision Board. Every route is mounted behind `authenticate` in index.ts,
 * so `req.user.id` is always a verified user. All queries are scoped to that
 * id — clients can never read, update or delete another user's milestones.
 *
 * Routes (all relative to /api/vision-milestones):
 *   GET    /              → list all milestones belonging to the caller
 *   POST   /              → create a milestone
 *   POST   /generate       → AI-generate a career roadmap's worth of milestones
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

// AI generation is far more expensive than plain CRUD, so it gets its own,
// tighter limit rather than sharing whatever's applied to the router as a whole.
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many roadmap generation requests. Please try again in a few minutes.' },
});

const MIN_MILESTONES = 5;
const MAX_MILESTONES = 7;
const MAX_GOAL_LENGTH = 200;

/** One item as the LLM is asked to return it, before validation/coercion. */
interface RawGeneratedMilestone {
  title?: unknown;
  description?: unknown;
  targetDate?: unknown;
}

/**
 * Validates and coerces one AI-generated milestone into the shape
 * db.visionMilestone.create() needs. Returns null for an entry that can't be
 * salvaged (no usable title) rather than throwing — one bad item out of 5-7
 * shouldn't sink the whole generation.
 */
function coerceGeneratedMilestone(
  raw: RawGeneratedMilestone,
  fallbackDate: Date
): { title: string; description: string; targetDate: Date } | null {
  const title = optStr(raw?.title);
  if (!title) return null;

  const description = optStr(raw?.description) ?? '';

  let targetDate = fallbackDate;
  const rawDate = optStr(raw?.targetDate);
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) targetDate = parsed;
  }

  return {
    title: title.length > MAX_TITLE ? title.slice(0, MAX_TITLE) : title,
    description: description.length > MAX_DESC ? description.slice(0, MAX_DESC) : description,
    targetDate,
  };
}

/**
 * POST /api/vision-milestones/generate
 * Body: { goal: string } — e.g. "Full Stack Developer"
 *
 * Asks the LLM for the 5-7 major milestones on the way to that career goal,
 * then persists each one as a real VisionMilestone row (not linked to any
 * specific Vision — this is a freeform goal string, not an existing vision
 * id) and returns the created rows.
 */
router.post('/generate', generateLimiter, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;

  const goal = optStr(req.body?.goal);
  if (!goal) {
    return res.status(400).json({ error: 'Please describe the career goal you want a roadmap for.' });
  }
  if (goal.length > MAX_GOAL_LENGTH) {
    return res.status(400).json({ error: `Career goal must be ${MAX_GOAL_LENGTH} characters or fewer.` });
  }

  try {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const systemPrompt = `You are an expert career coach and curriculum planner.
Given a student's long-term career goal, break it down into ${MIN_MILESTONES} to ${MAX_MILESTONES} major milestones required to realistically achieve that goal over time. These are big, sequential milestones (e.g. "Master core fundamentals", "Ship a portfolio project", "Land an internship", "Get your first professional role") — not small day-to-day tasks.

Today's date is ${todayIso}. Space the milestones a few months apart in a realistic, sequential order, starting a few months from today and extending outward as the goal gets more advanced.

You must return your output strictly as a JSON array (not an object, not wrapped in any other key) matching this schema:
[
  {
    "title": "string (short, action-oriented milestone title, under 120 characters)",
    "description": "string (2-3 sentences on what this milestone involves and why it matters, under 500 characters)",
    "targetDate": "string (a realistic future date in YYYY-MM-DD format, after ${todayIso})"
  }
]

Return between ${MIN_MILESTONES} and ${MAX_MILESTONES} milestones, ordered chronologically by targetDate. Do not wrap the output in markdown code blocks. Return only valid JSON.`;

    const userPrompt = `Career goal: "${goal}"\n\nGenerate the major milestones needed to achieve this career goal.`;

    const responseText = await aiService.generate(userPrompt, {
      systemPrompt,
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 1536,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (innerErr) {
        console.error('[api/vision-milestones/generate] AI returned non-JSON output. Raw:', responseText);
        return res.status(502).json({ error: 'The AI did not return a valid roadmap. Please try again.' });
      }
    }

    // Defend against the LLM wrapping the array in an object despite instructions.
    const rawList: RawGeneratedMilestone[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as any)?.milestones)
        ? (parsed as any).milestones
        : [];

    if (rawList.length === 0) {
      console.error('[api/vision-milestones/generate] AI returned an empty/invalid list. Raw:', responseText);
      return res.status(502).json({ error: 'The AI did not return any milestones. Please try again.' });
    }

    // Continue sort order after whatever milestones the user already has,
    // so generated ones don't all collide at sortOrder 0.
    const existingCount = await db.visionMilestone.count({ where: { userId } });

    const created: any[] = [];
    let index = 0;
    for (const raw of rawList.slice(0, MAX_MILESTONES)) {
      // Fallback spacing (every 3 months from today) if the AI omits/mangles a date.
      const fallbackDate = new Date(today);
      fallbackDate.setMonth(fallbackDate.getMonth() + (index + 1) * 3);

      const coerced = coerceGeneratedMilestone(raw, fallbackDate);
      if (!coerced) continue;

      const milestone = await db.visionMilestone.create({
        data: {
          userId,
          visionId: null,
          title: coerced.title,
          description: coerced.description,
          targetDate: coerced.targetDate,
          sortOrder: existingCount + index,
          completed: false,
        },
      });
      created.push(milestone);
      index++;
    }

    if (created.length === 0) {
      return res.status(502).json({ error: 'The AI did not return any usable milestones. Please try again.' });
    }

    return res.status(201).json({ success: true, milestones: created });
  } catch (error) {
    console.error('[api/vision-milestones/generate] Error:', error);
    return res.status(500).json({ error: 'Could not generate a career roadmap right now. Please try again.' });
  }
});

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
