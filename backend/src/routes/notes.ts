import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const MAX_NOTE_LENGTH = 20_000; // 20k characters

/**
 * GET /api/notes/:dayId
 * Fetch personal note for a specific day
 */
router.get('/:dayId', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const dayId = String(req.params.dayId);

    const note = await db.note.findUnique({
      where: {
        userId_dayId: { userId, dayId },
      },
    });

    return res.json({
      success: true,
      note: note || { content: '', updatedAt: null },
    });
  } catch (error) {
    console.error('[api/notes] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch personal note.' });
  }
});

/**
 * PUT /api/notes/:dayId
 * Upsert personal note content
 */
router.put('/:dayId', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const dayId = String(req.params.dayId);
    const { content, topicId } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Note content must be a string.' });
    }

    if (content.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({ error: `Note content exceeds max limit of ${MAX_NOTE_LENGTH} characters.` });
    }

    // Verify day exists and belongs to user
    const day = await db.day.findUnique({
      where: { id: dayId },
      include: { roadmap: { select: { userId: true } } },
    });

    if (!day || day.roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Day not found or access denied.' });
    }

    const note = await db.note.upsert({
      where: {
        userId_dayId: { userId, dayId },
      },
      create: {
        userId,
        dayId,
        topicId: topicId ? String(topicId) : null,
        content: content.trim(),
      },
      update: {
        content: content.trim(),
        topicId: topicId ? String(topicId) : undefined,
      },
    });

    return res.json({ success: true, note });
  } catch (error) {
    console.error('[api/notes] Upsert error:', error);
    return res.status(500).json({ error: 'Failed to save personal note.' });
  }
});

/**
 * DELETE /api/notes/:dayId
 * Clear personal note for a specific day
 */
router.delete('/:dayId', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const dayId = String(req.params.dayId);

    await db.note.deleteMany({
      where: { userId, dayId },
    });

    return res.json({ success: true, message: 'Note deleted.' });
  } catch (error) {
    console.error('[api/notes] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete note.' });
  }
});

export default router;
