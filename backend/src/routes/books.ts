import { Router, Request, Response } from 'express';
import db from '../lib/db';

const router = Router();

const GENRES = ['business', 'tech', 'science', 'self-improvement', 'history', 'health'];

/**
 * GET /api/books
 * Query params: category (genre), sort ('popularity'|'newest'|'relevance'),
 *               page (default 1), limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const category = String(req.query.category || '').toLowerCase();
    const sort = String(req.query.sort || 'popularity').toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

    const where: any = {};
    if (category && category !== 'all' && GENRES.includes(category)) {
      where.genre = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any;
    switch (sort) {
      case 'newest':
        orderBy = { publishedAt: 'desc' };
        break;
      case 'relevance':
        orderBy = { createdAt: 'desc' };
        break;
      case 'popularity':
      default:
        orderBy = [{ rating: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }];
        break;
    }

    const [data, total] = await Promise.all([
      db.bookSummary.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.bookSummary.count({ where }),
    ]);

    return res.json({ data, total, page, limit });
  } catch (err: any) {
    console.error('[api/books] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch books' });
  }
});

export default router;
