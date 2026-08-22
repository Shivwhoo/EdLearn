import express from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get all study rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await db.studyRoom.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { profile: { select: { fullName: true } }, email: true }
        }
      }
    });
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study rooms' });
  }
});

// Create a study room
router.post('/', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const room = await db.studyRoom.create({
      data: {
        name,
        description,
        createdBy: userId
      }
    });
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create study room' });
  }
});

// Get questions for a room
router.get('/:roomId/questions', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const questions = await db.roomQuestion.findMany({
      where: { roomId },
      skip,
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { profile: { select: { fullName: true } }, email: true } },
        answers: {
          include: {
            author: { select: { profile: { select: { fullName: true } }, email: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const total = await db.question.count({ where: { roomId } });

    res.json({ success: true, questions, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Post a question
router.post('/:roomId/questions', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { roomId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });

    const question = await db.roomQuestion.create({
      data: {
        title,
        body,
        roomId,
        authorId: userId
      },
      include: {
        author: { select: { profile: { select: { fullName: true } }, email: true } },
        answers: true
      }
    });
    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post question' });
  }
});

// Post an answer
router.post('/questions/:questionId/answers', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { questionId } = req.params;
    const { body } = req.body;

    if (!body) return res.status(400).json({ error: 'Body is required' });

    const answer = await db.roomAnswer.create({
      data: {
        body,
        questionId,
        authorId: userId
      },
      include: {
        author: { select: { profile: { select: { fullName: true } }, email: true } }
      }
    });
    res.json({ success: true, answer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post answer' });
  }
});

// Delete a question (only author)
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { questionId } = req.params;

    const question = await db.roomQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.authorId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.roomQuestion.delete({ where: { id: questionId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Delete an answer (only author)
router.delete('/answers/:answerId', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { answerId } = req.params;

    const answer = await db.roomAnswer.findUnique({ where: { id: answerId } });
    if (!answer || answer.authorId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.roomAnswer.delete({ where: { id: answerId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete answer' });
  }
});

export default router;
