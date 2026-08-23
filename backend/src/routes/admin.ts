import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Gated by ADMIN role
router.use(requireRole(['ADMIN']));

/**
 * GET /api/admin/stats
 * Overview of platform health and usage
 */
router.get('/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const [
      totalUsers,
      totalRoadmaps,
      totalTopics,
      totalProgress,
      totalQuizzes,
      totalBooks,
      totalMedia,
      totalNews,
    ] = await Promise.all([
      db.user.count(),
      db.roadmap.count(),
      db.topic.count(),
      db.progress.count(),
      db.quizAttempt.count(),
      db.bookSummary.count(),
      db.mediaContent.count(),
      db.newsArticle.count(),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalRoadmaps,
        totalTopics,
        totalProgress,
        totalQuizzes,
        content: {
          books: totalBooks,
          media: totalMedia,
          news: totalNews,
        },
      },
    });
  } catch (error) {
    console.error('[api/admin/stats] Error:', error);
    return res.status(500).json({ error: 'Failed to compile platform statistics.' });
  }
});

/**
 * GET /api/admin/users
 * Paginated list of users
 */
router.get('/users', async (req: Request, res: Response): Promise<any> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          credits: true,
          createdAt: true,
          profile: {
            select: {
              fullName: true,
              careerGoal: true,
              difficulty: true,
            },
          },
          _count: {
            select: {
              roadmaps: true,
              badges: true,
              progress: true,
              quizAttempts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return res.json({
      success: true,
      users,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[api/admin/users] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Update role of a specific user
 */
router.patch('/users/:id/role', async (req: Request, res: Response): Promise<any> => {
  const currentAdminId = (req as AuthenticatedRequest).user!.id;
  try {
    const { id } = req.params;
    const { role } = req.body;

    const VALID_ROLES = ['USER', 'ADMIN', 'MODERATOR'];
    if (!role || !VALID_ROLES.includes(String(role).toUpperCase())) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (id === currentAdminId && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot demote your own admin account.' });
    }

    const updatedUser = await db.user.update({
      where: { id: String(id) },
      data: { role: String(role).toUpperCase() },
      select: { id: true, email: true, role: true },
    });

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[api/admin/users/role] Error:', error);
    return res.status(500).json({ error: 'Failed to update user role.' });
  }
});

export default router;
