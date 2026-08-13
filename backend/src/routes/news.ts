import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { validateQuery } from '../middleware/validate';
import { NewsQuerySchema } from '../schemas/content.schemas';

const router = Router();

// Rate limit: 60 requests per 15 minutes per IP
const newsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the news API. Please try again in 15 minutes.' },
});

router.use(newsLimiter);

const CATEGORIES = ['tech', 'finance', 'world', 'medical', 'science', 'education'];

const TIMEFRAME_MS: Record<string, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  '3months': 90 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

let lastNewsFetch = 0;

/**
 * GET /api/news
 * Query params: category, timeframe ('week'|'month'|'3months'|'year'),
 *               page (default 1), limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', validateQuery(NewsQuerySchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const q = (req as any).validatedQuery as {
      category?: string;
      timeframe?: string;
      search?: string;
      page?: number;
      limit?: number;
    };

    const category = (q.category || '').toLowerCase();
    const timeframe = (q.timeframe || '').toLowerCase();
    const search = (q.search || '').trim();
    const page = Math.max(1, q.page || 1);
    const limit = Math.min(50, Math.max(1, q.limit || 20));

    // M6: Trigger background update on page refresh (throttled to once per 5 min)
    if (Date.now() - lastNewsFetch > 5 * 60 * 1000) {
      lastNewsFetch = Date.now();
      runNewsFetch().catch((err) => console.error('[api/news] Background update error:', err));
    }

    const where: any = {};
    if (category && category !== 'all' && CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (timeframe && TIMEFRAME_MS[timeframe]) {
      where.publishedAt = { gte: new Date(Date.now() - TIMEFRAME_MS[timeframe]) };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      db.newsArticle.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.newsArticle.count({ where }),
    ]);

    return res.json({ data, total, page, limit });
  } catch (err: any) {
    console.error('[api/news] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch news' });
  }
});

export default router;

