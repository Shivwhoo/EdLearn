import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import aiService from '../lib/ai/aiService';
import GamificationService from '../services/gamification.service';
import { enqueueAITask } from '../lib/queue';
import { canGenerateAIContent } from '../lib/entitlement';

const FLASHCARD_INTERVALS = {
  again: 10,
  hard: 1440,
  goodFirst: 4320,
  easyFirst: 10080
};

const flashcardLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const evaluateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
const router = Router();

// POST /api/topics/:topicId/flashcards/generate
// KNOWN V1 LIMITATION: No database-level unique constraint prevents duplicate generation
// requests in-flight simultaneously. To mitigate, the frontend MUST immediately disable
// the "Generate Flashcards" button upon click until the response resolves.
router.post('/topics/:topicId/flashcards/generate', flashcardLimiter, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const topicId = req.params.topicId as string;

  try {
    const existingCards = await db.flashcard.findMany({
      where: { userId, topicId },
      include: { progress: true }
    });

    if (existingCards.length > 0) {
      return res.json({ success: true, flashcards: existingCards });
    }

    const isAllowed = await canGenerateAIContent(userId, topicId);
    if (!isAllowed) {
      return res.status(402).json({ error: 'Daily FREE tier AI generation limit reached.' });
    }

    const topic = await db.topic.findFirst({
      where: { id: topicId, day: { roadmap: { userId } } }
    });

    if (!topic) return res.status(403).json({ error: 'Topic not found or access denied.' });

    // Enqueue the generation job
    const job = await enqueueAITask('generate_flashcards', { topicId }, userId);

    return res.status(202).json({ success: true, jobId: job.id });
  } catch (error) {
    console.error('[api/flashcards] Generate error:', error);
    return res.status(500).json({ error: 'Could not generate flashcards.' });
  }
});

// GET /api/flashcards/due
router.get('/flashcards/due', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;

  try {
    const dueCards = await db.flashcard.findMany({
      where: {
        userId,
        progress: { nextReview: { lte: new Date() } }
      },
      include: { progress: true },
      orderBy: { progress: { nextReview: 'asc' } }
    });

    return res.json({ success: true, flashcards: dueCards });
  } catch (error) {
    console.error('[api/flashcards] Fetch due error:', error);
    return res.status(500).json({ error: 'Could not fetch due flashcards.' });
  }
});

// POST /api/flashcards/:id/review
router.post('/flashcards/:id/review', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const flashcardId = req.params.id as string;
  const { rating } = req.body;

  if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
    return res.status(400).json({ error: 'Invalid rating. Must be again, hard, good, or easy.' });
  }

  try {
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
      include: { progress: true }
    });

    if (!flashcard || !flashcard.progress) {
      return res.status(404).json({ error: 'Flashcard not found or access denied.' });
    }

    const p = flashcard.progress;
    let newInterval = p.interval;
    let newEase = p.easeFactor;

    if (rating === 'again') {
      newInterval = FLASHCARD_INTERVALS.again;
      newEase = Math.max(1.3, newEase - 0.2); 
    } else if (rating === 'hard') {
      newInterval = Math.max(FLASHCARD_INTERVALS.hard, Math.round(newInterval * 1.2));
      newEase = Math.max(1.3, newEase - 0.15);
    } else if (rating === 'good') {
      newInterval = p.repetitions === 0 ? FLASHCARD_INTERVALS.goodFirst : Math.round(newInterval * newEase);
    } else if (rating === 'easy') {
      newInterval = p.repetitions === 0 ? FLASHCARD_INTERVALS.easyFirst : Math.round(newInterval * newEase * 1.3);
      newEase += 0.15; 
    }

    const nextReview = new Date(Date.now() + newInterval * 60 * 1000);

    const updatedProgress = await db.flashcardProgress.update({
      where: { flashcardId },
      data: {
        interval: newInterval,
        easeFactor: newEase,
        nextReview,
        repetitions: rating === 'again' ? 0 : p.repetitions + 1
      }
    });

    await GamificationService.recordActivity(userId, 'FLASHCARD_REVIEWED')
      .catch(err => console.error('gamification event failed', err));

    return res.json({ success: true, progress: updatedProgress });
  } catch (error) {
    console.error('[api/flashcards] Review error:', error);
    return res.status(500).json({ error: 'Could not submit review.' });
  }
});

// POST /api/flashcards/:id/evaluate
router.post('/flashcards/:id/evaluate', evaluateLimiter, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const flashcardId = req.params.id as string;
  const { userAnswer } = req.body;

  if (!userAnswer || typeof userAnswer !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userAnswer.' });
  }

  try {
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId }
    });

    if (!flashcard) {
      return res.status(404).json({ error: 'Flashcard not found or access denied.' });
    }

    const evaluation = await aiService.evaluateFlashcardAnswer(
      flashcard.front,
      flashcard.back,
      userAnswer
    );

    return res.json({ success: true, evaluation });
  } catch (error) {
    console.error('[api/flashcards] Evaluate error:', error);
    return res.status(500).json({ error: 'Could not evaluate answer.' });
  }
});

export default router;
