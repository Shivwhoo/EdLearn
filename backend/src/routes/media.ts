import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { runMediaFetch } from '../services/mediaCron';

const router = Router();

const CATEGORIES = ['business', 'science', 'history', 'health', 'tech', 'culture'];
const TYPES = ['video', 'audio'];

let lastMediaFetch = 0;

/**
 * GET /api/media
 * Query params: category, type ('video'|'audio'), page (default 1),
 *               limit (default 20, max 50), search
 * Returns: { data, total, page, limit }
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const category = String(req.query.category || '').toLowerCase();
    const type = String(req.query.type || '').toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

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

