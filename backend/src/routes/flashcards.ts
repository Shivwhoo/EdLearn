import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateSM2 } from '../services/sm2Service';

const router = Router();

/**
 * GET /api/flashcards/due
 * Retrieve flashcards due for review for the current user.
 */
router.get('/due', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const flashcards = await db.flashcard.findMany({
      where: {
        userId,
        dueDate: {
          lte: new Date(),
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 100, // Limit to 100 due cards at a time
    });

    return res.json({ success: true, flashcards });
  } catch (error) {
    console.error('[api/flashcards/due] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch due flashcards.' });
  }
});

/**
 * POST /api/flashcards/review
 * Submit a review score for a flashcard and update its SM-2 scheduling.
 * Body: { flashcardId: string, quality: number (0-5) }
 */
router.post('/review', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { flashcardId, quality } = req.body;

    if (!flashcardId || typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Missing or invalid parameters: flashcardId, quality (0-5).' });
    }

    const flashcard = await db.flashcard.findUnique({
      where: { id: flashcardId },
    });

    if (!flashcard || flashcard.userId !== userId) {
      return res.status(404).json({ error: 'Flashcard not found or access denied.' });
    }

    const nextSM2 = calculateSM2(
      quality,
      flashcard.easeFactor,
      flashcard.interval,
      flashcard.repetitions
    );

    const updatedFlashcard = await db.flashcard.update({
      where: { id: flashcardId },
      data: {
        easeFactor: nextSM2.easeFactor,
        interval: nextSM2.interval,
        repetitions: nextSM2.repetitions,
        dueDate: nextSM2.dueDate,
      },
    });

    return res.json({ success: true, flashcard: updatedFlashcard });
  } catch (error) {
    console.error('[api/flashcards/review] Error:', error);
    return res.status(500).json({ error: 'Failed to record flashcard review.' });
  }
});

export default router;
