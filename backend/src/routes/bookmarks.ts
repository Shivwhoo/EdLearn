import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const bookmarkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many bookmark requests. Please try again later.' },
});

router.use(bookmarkLimiter);

const VALID_ITEM_TYPES = ['book', 'media', 'news', 'topic'] as const;
type ItemType = (typeof VALID_ITEM_TYPES)[number];

/**
 * GET /api/bookmarks
 * Query params: itemType ('book'|'media'|'news'|'topic'), page, limit
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const itemType = typeof req.query.itemType === 'string' ? req.query.itemType.toLowerCase() : undefined;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));

    const where: any = { userId };
    if (itemType && (VALID_ITEM_TYPES as readonly string[]).includes(itemType)) {
      where.itemType = itemType;
    }

    const [bookmarks, total] = await Promise.all([
      db.bookmark.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.bookmark.count({ where }),
    ]);

    return res.json({
      success: true,
      bookmarks,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[api/bookmarks] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch bookmarks.' });
  }
});

/**
 * GET /api/bookmarks/check
 * Query params: itemType, itemId
 */
router.get('/check', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { itemType, itemId } = req.query;
    if (!itemType || !itemId) {
      return res.status(400).json({ error: 'Missing itemType or itemId query parameter.' });
    }

    const existing = await db.bookmark.findFirst({
      where: {
        userId,
        itemType: String(itemType).toLowerCase(),
        itemId: String(itemId),
      },
    });

    return res.json({
      success: true,
      isBookmarked: !!existing,
      bookmarkId: existing?.id || null,
    });
  } catch (error) {
    console.error('[api/bookmarks] Check error:', error);
    return res.status(500).json({ error: 'Failed to verify bookmark status.' });
  }
});

/**
 * POST /api/bookmarks
 * Body: { itemType, itemId, title, metadata }
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { itemType, itemId, title, metadata } = req.body;

    if (!itemType || !itemId || !title) {
      return res.status(400).json({ error: 'Missing required parameters: itemType, itemId, title.' });
    }

    const cleanType = String(itemType).toLowerCase().trim();
    if (!(VALID_ITEM_TYPES as readonly string[]).includes(cleanType)) {
      return res.status(400).json({
        error: `Invalid itemType. Must be one of: ${VALID_ITEM_TYPES.join(', ')}`,
      });
    }

    const bookmark = await db.bookmark.upsert({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: cleanType,
          itemId: String(itemId).trim(),
        },
      },
      create: {
        userId,
        itemType: cleanType,
        itemId: String(itemId).trim(),
        title: String(title).slice(0, 300).trim(),
        metadata: metadata ? metadata : undefined,
      },
      update: {
        title: String(title).slice(0, 300).trim(),
        metadata: metadata ? metadata : undefined,
      },
    });

    return res.status(201).json({ success: true, bookmark });
  } catch (error) {
    console.error('[api/bookmarks] Create error:', error);
    return res.status(500).json({ error: 'Failed to save bookmark.' });
  }
});

/**
 * DELETE /api/bookmarks/:id
 */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { id } = req.params;
    const deleted = await db.bookmark.deleteMany({
      where: { id: String(id), userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Bookmark not found.' });
    }

    return res.json({ success: true, message: 'Bookmark removed.' });
  } catch (error) {
    console.error('[api/bookmarks] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete bookmark.' });
  }
});

export default router;
