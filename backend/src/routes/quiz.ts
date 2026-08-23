import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const quizLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many quiz submissions. Please slow down.' },
});

router.use(quizLimiter);

/**
 * POST /api/quiz/submit
 * Body: { dayId, topicId?, score, totalQuestions, answers }
 */
router.post('/submit', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { dayId, topicId, score, totalQuestions, answers } = req.body;

    if (!dayId || typeof score !== 'number' || typeof totalQuestions !== 'number') {
      return res.status(400).json({ error: 'Missing required parameters: dayId, score, totalQuestions.' });
    }

    if (totalQuestions <= 0 || score < 0 || score > totalQuestions) {
      return res.status(400).json({ error: 'Invalid score or totalQuestions count.' });
    }

    // Verify ownership of the day
    const day = await db.day.findUnique({
      where: { id: dayId },
      include: { roadmap: { select: { userId: true, title: true } } },
    });

    if (!day || day.roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Day not found or access denied.' });
    }

    const percentage = Math.round((score / totalQuestions) * 100);
    const passed = percentage >= 70;

    // Create quiz attempt record
    const attempt = await db.quizAttempt.create({
      data: {
        userId,
        dayId,
        topicId: topicId ? String(topicId) : null,
        score,
        totalQuestions,
        answers: answers || {},
      },
    });

    // Auto-generate flashcards for missed questions (if provided).
    // Flashcard.topicId is required, so a question without a topicId is skipped.
    if (topicId && req.body.failedQuestions && Array.isArray(req.body.failedQuestions)) {
      for (const fq of req.body.failedQuestions) {
        if (fq.question && fq.correctAnswer) {
          await db.flashcard.create({
            data: {
              userId,
              topicId: String(topicId),
              front: fq.question,
              back: fq.correctAnswer,
            }
          });
        }
      }
    }

    // Check if score is >= 80% to award Quiz Mastery notification
    if (percentage >= 80) {
      await db.notification.create({
        data: {
          userId,
          title: `Quiz Mastery: Day ${day.dayNumber}`,
          message: `You scored ${percentage}% on "${day.title}". Excellent understanding!`,
          type: 'achievement',
          link: '/workspace',
        },
      });
    }

    return res.status(201).json({
      success: true,
      attempt,
      percentage,
      passed,
      feedback: passed
        ? 'Great job! You have demonstrated solid comprehension of this topic.'
        : 'Review the study guide notes and try the quiz again to solidify your knowledge.',
    });
  } catch (error) {
    console.error('[api/quiz/submit] Error:', error);
    return res.status(500).json({ error: 'Failed to record quiz submission.' });
  }
});

/**
 * GET /api/quiz/history/:dayId
 * Returns all past attempts for the specified day
 */
router.get('/history/:dayId', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const dayId = String(req.params.dayId);

    const attempts = await db.quizAttempt.findMany({
      where: { userId, dayId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let bestScore = 0;
    let bestPercentage = 0;

    if (attempts.length > 0) {
      for (const a of attempts) {
        const pct = Math.round((a.score / a.totalQuestions) * 100);
        if (pct > bestPercentage) {
          bestPercentage = pct;
          bestScore = a.score;
        }
      }
    }

    return res.json({
      success: true,
      attempts,
      latestAttempt: attempts[0] || null,
      bestScore,
      bestPercentage,
    });
  } catch (error) {
    console.error('[api/quiz/history] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch quiz history.' });
  }
});

export default router;
