import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { validateQuery } from '../middleware/validate';
import { MediaQuerySchema } from '../schemas/content.schemas';
import { runMediaFetch } from '../services/mediaCron';

const router = Router();

// Rate limit: 60 requests per 15 minutes per IP
const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the media API. Please try again in 15 minutes.' },
});

router.use(mediaLimiter);

const CATEGORIES = ['business', 'science', 'history', 'health', 'tech', 'culture'];
const TYPES = ['video', 'audio'];

let lastMediaFetch = 0;

/**
 * GET /api/media
 * Query params: category, type ('video'|'audio'), page (default 1),
 *               limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', validateQuery(MediaQuerySchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const q = (req as any).validatedQuery as {
      category?: string;
      type?: string;
      search?: string;
      page?: number;
      limit?: number;
    };

    const category = (q.category || '').toLowerCase();
    const type = (q.type || '').toLowerCase();
    const search = (q.search || '').trim();
    const page = Math.max(1, q.page || 1);
    const limit = Math.min(50, Math.max(1, q.limit || 20));

    // M6: Trigger background update on page refresh (throttled to once per 5 min)
    if (Date.now() - lastMediaFetch > 5 * 60 * 1000) {
      lastMediaFetch = Date.now();
      runMediaFetch().catch((err) => console.error('[api/media] Background update error:', err));
    }

    const where: any = {};
    if (category && category !== 'all' && CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (type && TYPES.includes(type)) {
      where.contentType = type;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { channelName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      db.mediaContent.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.mediaContent.count({ where }),
    ]);

    return res.json({ data, total, page, limit });
  } catch (err: any) {
    console.error('[api/media] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch media' });
  }
});

export default router;

