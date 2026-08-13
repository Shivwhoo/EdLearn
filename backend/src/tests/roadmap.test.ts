/**
 * Roadmap Route Integration Tests — POST /api/roadmap
 *
 * Tests the Zod-validated roadmap creation handler:
 * - Auth guard
 * - Schema validation (goal, deadline, availableTime, difficulty)
 * - Successful creation path (mocked AI + Prisma)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validate } from '../middleware/validate';
import { RoadmapCreateSchema } from '../schemas/roadmap.schemas';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

// ── Mocked modules ────────────────────────────────────────────────────────────
import db from '../lib/db';
import { redisCache } from '../lib/redis';
import { aiService } from '../lib/ai/aiService';

const mockDb = db as any;
const mockCache = redisCache as any;
const mockAi = aiService as any;

// ── Minimal app stub ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const MOCK_ROADMAP_AI_RESPONSE = JSON.stringify({
  title: 'Test Roadmap',
  isAchievable: true,
  feasibilityNote: 'Perfectly achievable',
  days: [
    { dayNumber: 1, title: 'Day 1 – Intro', durationMinutes: 60 },
    { dayNumber: 2, title: 'Day 2 – Deep Dive', durationMinutes: 60 },
  ],
});

app.post(
  '/api/roadmap',
  authenticate,
  validate(RoadmapCreateSchema),
  async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { goal, deadline, availableTime, difficulty } = req.body;
      const activeUserId = (req as AuthenticatedRequest).user!.id;

      const raw = await mockAi.generate('prompt');
      const roadmapData = JSON.parse(raw);

      const createdRoadmap = await mockDb.roadmap.create({
        data: {
          userId: activeUserId,
          title: roadmapData.title,
          deadline: new Date(deadline),
          isAchievable: roadmapData.isAchievable,
          days: { create: roadmapData.days },
        },
        include: { days: true },
      });

      await mockCache.setCache(`active_roadmap:${activeUserId}`, createdRoadmap.id, 2592000);
      await mockCache.deleteCache(`dashboard:${activeUserId}`);

      return res.json({ success: true, roadmap: createdRoadmap, feasibility: roadmapData.feasibilityNote });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeAuthHeader() {
  mockDb.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
  const { generateToken } = await import('../lib/auth');
  return `Bearer ${generateToken({ id: 'user-id', email: 'test@example.com' })}`;
}

function futureDate(daysAhead = 30) {
  return new Date(Date.now() + daysAhead * 86400_000).toISOString();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/roadmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAi.generate.mockResolvedValue(MOCK_ROADMAP_AI_RESPONSE);
    mockDb.roadmap.create.mockResolvedValue({
      id: 'roadmap-id-1',
      title: 'Test Roadmap',
      isAchievable: true,
      days: [],
    });
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).post('/api/roadmap').send({
      goal: 'Learn TypeScript',
      deadline: futureDate(),
      availableTime: 60,
      difficulty: 'Intermediate',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when goal is missing', async () => {
    const auth = await makeAuthHeader();
    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({ deadline: futureDate(), availableTime: 60, difficulty: 'Intermediate' });

    expect(res.status).toBe(400);
    expect(res.body.details.goal).toBeDefined();
  });

  it('returns 400 when deadline is in the past', async () => {
    const auth = await makeAuthHeader();
    const pastDate = new Date(Date.now() - 86400_000).toISOString();

    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({ goal: 'Learn React', deadline: pastDate, availableTime: 60, difficulty: 'Intermediate' });

    expect(res.status).toBe(400);
    expect(res.body.details.deadline).toBeDefined();
  });

  it('returns 400 when availableTime is below 15', async () => {
    const auth = await makeAuthHeader();
    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({ goal: 'Learn React', deadline: futureDate(), availableTime: 10, difficulty: 'Intermediate' });

    expect(res.status).toBe(400);
    expect(res.body.details.availableTime).toBeDefined();
  });

  it('returns 400 when difficulty is invalid', async () => {
    const auth = await makeAuthHeader();
    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({ goal: 'Learn Go', deadline: futureDate(), availableTime: 60, difficulty: 'Expert' });

    expect(res.status).toBe(400);
    expect(res.body.details.difficulty).toBeDefined();
  });

  it('creates and returns roadmap on valid input', async () => {
    const auth = await makeAuthHeader();
    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({
        goal: 'Master TypeScript',
        deadline: futureDate(60),
        availableTime: 90,
        difficulty: 'Advanced',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.roadmap).toBeDefined();
    expect(res.body.feasibility).toBe('Perfectly achievable');
    // Redis cache must be set for active roadmap
    expect(mockCache.setCache).toHaveBeenCalledWith(
      expect.stringContaining('active_roadmap:'),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('accepts availableTime as a string (Zod coercion)', async () => {
    const auth = await makeAuthHeader();
    const res = await request(app)
      .post('/api/roadmap')
      .set('Authorization', auth)
      .send({
        goal: 'Learn Rust',
        deadline: futureDate(30),
        availableTime: '60', // string — Zod should coerce to number
        difficulty: 'Beginner',
      });

    expect(res.status).toBe(200);
  });
});
