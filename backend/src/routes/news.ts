import { Router, Request, Response } from 'express';
import db from '../lib/db';

const router = Router();

const CATEGORIES = ['tech', 'finance', 'world', 'medical', 'science', 'education'];

const TIMEFRAME_MS: Record<string, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  '3months': 90 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * GET /api/news
 * Query params: category, timeframe ('week'|'month'|'3months'|'year'),
 *               page (default 1), limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const category = String(req.query.category || '').toLowerCase();
    const timeframe = String(req.query.timeframe || '').toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

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
