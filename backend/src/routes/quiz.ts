import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';
import aiService from '../lib/ai/aiService';
import GamificationService from '../services/gamification.service';
import { canGenerateAIContent } from '../lib/entitlement';

const quizLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const router = Router();

// POST /api/topics/:topicId/quick-check
router.post('/topics/:topicId/quick-check', quizLimiter, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const topicId = req.params.topicId as string;

  try {
    const existingQuiz = await db.quiz.findUnique({
      where: { userId_topicId: { userId, topicId } },
      include: { questions: { orderBy: { order: 'asc' } } }
    });

    if (existingQuiz) {
      return res.json({ success: true, quiz: existingQuiz });
    }

    const isAllowed = await canGenerateAIContent(userId, topicId);
    if (!isAllowed) {
      return res.status(402).json({ error: 'Daily FREE tier AI generation limit reached.' });
    }

    const topic = await db.topic.findFirst({
      where: { id: topicId, day: { roadmap: { userId } } }
    });

    if (!topic) return res.status(403).json({ error: 'Topic not found or access denied.' });

    const generatedQuestions = await aiService.generateQuiz(topic.notesHtml);

    const newQuiz = await db.quiz.create({
      data: {
        userId,
        topicId,
        questions: {
          create: generatedQuestions.map((q, index) => ({
             questionText: q.questionText,
             options: q.options,
             correctIndex: q.correctIndex,
             explanation: q.explanation || '',
             order: index
          }))
        }
      },
      include: { questions: { orderBy: { order: 'asc' } } }
    });

    return res.status(201).json({ success: true, quiz: newQuiz });
  } catch (error) {
    console.error('[api/quiz] Generate error:', error);
    return res.status(500).json({ error: 'Could not generate quiz.' });
  }
});

// POST /api/quiz/:quizId/submit
router.post('/quiz/:quizId/submit', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const quizId = req.params.quizId as string;
  const { answers } = req.body;

  try {
    const existingAttempt = await db.quizAttempt.findFirst({
      where: { quizId, userId }
    });

    if (existingAttempt) {
      return res.status(409).json({ error: 'Quiz already completed.' });
    }

    const quiz = await db.quiz.findFirst({
      where: { id: quizId, userId },
      include: { questions: { orderBy: { order: 'asc' } } }
    });

    if (!quiz) return res.status(403).json({ error: 'Quiz not found or access denied.' });

    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ error: `Please provide exactly ${quiz.questions.length} answers.` });
    }

    if (answers.some(a => typeof a !== 'number' || a < 0 || a > 3)) {
      return res.status(400).json({ error: 'Answers must be numbers between 0 and 3.' });
    }

    const score = quiz.questions.reduce((total: number, q: any, i: number) => 
      answers[i] === q.correctIndex ? total + 1 : total, 
    0);

    const attempt = await db.quizAttempt.create({
      data: { quizId, userId, score }
    });

    await GamificationService.recordActivity(userId, 'QUIZ_COMPLETED', { score })
      .catch(err => console.error('gamification event failed', err));

    return res.json({ success: true, attempt, score });
  } catch (error) {
    console.error('[api/quiz] Submit error:', error);
    return res.status(500).json({ error: 'Could not submit quiz.' });
  }
});

export default router;
