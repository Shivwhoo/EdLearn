import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { validateQuery } from '../middleware/validate';
import { BooksQuerySchema } from '../schemas/content.schemas';

const router = Router();

// Rate limit: 60 requests per 15 minutes per IP
const booksLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the books API. Please try again in 15 minutes.' },
});

router.use(booksLimiter);

const GENRES = ['business', 'tech', 'science', 'self-improvement', 'history', 'health'];

/**
 * GET /api/books
 * Query params: category (genre), sort ('popularity'|'newest'|'relevance'),
 *               page (default 1), limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', validateQuery(BooksQuerySchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const q = (req as any).validatedQuery as {
      category?: string;
      sort?: string;
      search?: string;
      page?: number;
      limit?: number;
    };

    const category = (q.category || '').toLowerCase();
    const sort = (q.sort || 'popularity').toLowerCase();
    const search = (q.search || '').trim();
    const page = Math.max(1, q.page || 1);
    const limit = Math.min(50, Math.max(1, q.limit || 20));

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
