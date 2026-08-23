import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { reviewFlashcard } from '../services/sm2Service';

const router = Router();

/**
 * GET /api/flashcards/due
 * Retrieve flashcards due for review for the current user.
 * Due-ness now lives on the related FlashcardProgress row (nextReview), not
 * on Flashcard itself. A flashcard with no FlashcardProgress row yet (never
 * reviewed) is treated as due.
 */
router.get('/due', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const flashcards = await db.flashcard.findMany({
      where: {
        userId,
        OR: [
          { progress: null },
          { progress: { nextReview: { lte: new Date() } } },
        ],
      },
      include: { progress: true },
      orderBy: {
        createdAt: 'asc',
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
 * SM-2 state (easeFactor, interval, repetitions, nextReview) is read from
 * and written to the FlashcardProgress table, not Flashcard.
 * Body: { flashcardId: string, quality: number (0-5) }
 */
router.post('/review', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { flashcardId, quality } = req.body;

    if (!flashcardId || typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Missing or invalid parameters: flashcardId, quality (0-5).' });
    }

    const progress = await reviewFlashcard(userId, flashcardId, quality);

    if (!progress) {
      return res.status(404).json({ error: 'Flashcard not found or access denied.' });
    }

    return res.json({ success: true, progress });
  } catch (error) {
    console.error('[api/flashcards/review] Error:', error);
    return res.status(500).json({ error: 'Failed to record flashcard review.' });
  }
});

export default router;
