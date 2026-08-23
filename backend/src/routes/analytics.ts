import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateUserStreaks } from '../services/streakService';
import { redisCache } from '../lib/redis';

const router = Router();

/**
 * GET /api/progress/analytics
 * Returns the caller's streak metrics, 365-day activity matrix, and weekly progress.
 */
router.get('/analytics', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const cacheKey = `analytics:${userId}`;
    const cached = await redisCache.getCache(cacheKey);

    if (cached) {
      try {
        return res.json({ success: true, analytics: JSON.parse(cached), fromCache: true });
      } catch {
        // Fall through to live calculation
      }
    }

    const analytics = await calculateUserStreaks(userId);

    // Cache for 5 minutes
    await redisCache.setCache(cacheKey, JSON.stringify(analytics), 300);

    return res.json({
      success: true,
      analytics,
      fromCache: false,
    });
  } catch (error) {
    console.error('[api/progress/analytics] Error:', error);
    return res.status(500).json({ error: 'Failed to compile learning analytics.' });
  }
});

export default router;
