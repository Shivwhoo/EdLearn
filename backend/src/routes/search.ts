import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please try again in a few moments.' },
});

router.use(searchLimiter);

/**
 * GET /api/search/universal
 * Query params: q (search term), limitPerType (default 5, max 10)
 */
router.get('/universal', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user?.id;
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        query: q,
        results: {
          books: [],
          media: [],
          news: [],
          topics: [],
        },
        totalCount: 0,
      });
    }

    const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limitPerType || '5'), 10)));

    const [books, media, news, topics] = await Promise.all([
      // 1. Books
      db.bookSummary.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { author: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ rating: { sort: 'desc', nulls: 'last' } }],
      }),

      // 2. Media (Videos & Podcasts)
      db.mediaContent.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { channelName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),

      // 3. News Articles
      db.newsArticle.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { source: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),

      // 4. Study Topics (if user is authenticated)
      userId
        ? db.topic.findMany({
            where: {
              day: { roadmap: { userId } },
              title: { contains: q, mode: 'insensitive' },
            },
            include: {
              day: {
                select: {
                  dayNumber: true,
                  roadmap: { select: { id: true, title: true } },
                },
              },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const totalCount = books.length + media.length + news.length + topics.length;

    return res.json({
      success: true,
      query: q,
      results: {
        books: books.map((b) => ({
          id: b.id,
          type: 'book',
          title: b.title,
          subtitle: `by ${b.author}`,
          genre: b.genre,
          coverImage: b.coverImage,
          rating: b.rating,
          description: b.threeSentenceTakeaway || b.description.slice(0, 150),
          link: `/books?search=${encodeURIComponent(b.title)}`,
        })),
        media: media.map((m) => ({
          id: m.id,
          type: m.contentType, // 'video' | 'audio'
          title: m.title,
          subtitle: `${m.platform === 'youtube' ? 'YouTube' : 'Podcast'} · ${m.channelName}`,
          category: m.category,
          thumbnailUrl: m.thumbnailUrl,
          duration: m.duration,
          link: `/media?search=${encodeURIComponent(m.title)}`,
        })),
        news: news.map((n) => ({
          id: n.id,
          type: 'news',
          title: n.title,
          subtitle: `${n.source} · ${new Date(n.publishedAt).toLocaleDateString()}`,
          category: n.category,
          imageUrl: n.imageUrl,
          link: `/news?search=${encodeURIComponent(n.title)}`,
        })),
        topics: topics.map((t) => ({
          id: t.id,
          type: 'topic',
          title: t.title,
          subtitle: `Roadmap: ${t.day?.roadmap?.title} (Day ${t.day?.dayNumber})`,
          link: `/workspace`,
        })),
      },
      totalCount,
    });
  } catch (error) {
    console.error('[api/search/universal] Search error:', error);
    return res.status(500).json({ error: 'Search operation failed.' });
  }
});

export default router;
