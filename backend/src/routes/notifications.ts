import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * Returns recent notifications and unread count
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('[api/notifications] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { id } = req.params;

    const notification = await db.notification.updateMany({
      where: { id: String(id), userId },
      data: { read: true },
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[api/notifications/read] Error:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('[api/notifications/read-all] Error:', error);
    return res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { id } = req.params;

    const deleted = await db.notification.deleteMany({
      where: { id: String(id), userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ success: true, message: 'Notification removed.' });
  } catch (error) {
    console.error('[api/notifications/delete] Error:', error);
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

export default router;
