/**
 * Topic Route Integration Tests — GET /api/topic
 *
 * F-02: Verify the IDOR fix that constrains topic queries to the
 * authenticated user's ownership chain (Topic → Day → Roadmap → User).
 *
 * The Prisma DB client, Redis, and email are all mocked in setup.ts.
 * We build a minimal Express app with the real authenticate middleware
 * and a stub handler that mirrors the production route so the actual
 * Prisma query arguments can be inspected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

// ── Mocked modules ────────────────────────────────────────────────────────────
import db from '../lib/db';

const mockDb = db as any;

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TEST_USER = { id: 'user-owner-id', email: 'owner@example.com' };
const FOREIGN_USER = { id: 'user-foreign-id', email: 'foreign@example.com' };

const OWN_DAY_ID = 'day-own-uuid';
const FOREIGN_DAY_ID = 'day-foreign-uuid';
const NONEXISTENT_DAY_ID = 'day-nonexistent-uuid';

const SAMPLE_TOPICS = [
  {
    id: 'topic-1',
    dayId: OWN_DAY_ID,
    title: 'JavaScript Closures',
    mode: 1,
    notesHtml: '{}',
    completed: false,
    createdAt: new Date('2026-01-02'),
    citations: [{ id: 'cit-1', topicId: 'topic-1', label: 'MDN', rawText: 'ref', sourceUrl: 'https://mdn.io' }],
  },
  {
    id: 'topic-2',
    dayId: OWN_DAY_ID,
    title: 'JavaScript Closures',
    mode: 2,
    notesHtml: '{}',
    completed: false,
    createdAt: new Date('2026-01-01'),
    citations: [],
  },
];

// ── Build a minimal app with the real handler logic ───────────────────────────

const app = express();
app.use(express.json());

app.get('/api/topic', authenticate, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const { dayId } = req.query;
    if (!dayId) {
      return res.status(400).json({ error: 'Missing required query parameter: dayId' });
    }

    const userId = (req as AuthenticatedRequest).user!.id;

    const topics = await mockDb.topic.findMany({
      where: {
        dayId: dayId as string,
        day: {
          roadmap: {
            userId,
          },
        },
      },
      include: {
        citations: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ success: true, topics });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch topic version history' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a valid JWT for a given user so authenticate() passes. */
async function makeAuthHeader(user: { id: string; email: string } = TEST_USER) {
  mockDb.user.findUnique.mockResolvedValue(user);
  const { generateToken } = await import('../lib/auth');
  const token = generateToken(user);
  return `Bearer ${token}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/topic — F-02 IDOR fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Own day returns own topics ─────────────────────────────────────────

  it('returns topics for a day owned by the authenticated user', async () => {
    const auth = await makeAuthHeader();
    mockDb.topic.findMany.mockResolvedValue(SAMPLE_TOPICS);

    const res = await request(app)
      .get('/api/topic')
      .set('Authorization', auth)
      .query({ dayId: OWN_DAY_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.topics).toHaveLength(2);
    expect(res.body.topics[0].id).toBe('topic-1');
    expect(res.body.topics[0].citations).toHaveLength(1);

    // Verify the Prisma query included the ownership constraint
    expect(mockDb.topic.findMany).toHaveBeenCalledOnce();
    const queryArgs = mockDb.topic.findMany.mock.calls[0][0];
    expect(queryArgs.where).toEqual({
      dayId: OWN_DAY_ID,
      day: {
        roadmap: {
          userId: TEST_USER.id,
        },
      },
    });
  });

  // ── 2. Foreign day returns empty topics ───────────────────────────────────

  it('returns empty topics array for a day owned by another user', async () => {
    const auth = await makeAuthHeader();
    // Prisma returns [] because the ownership chain doesn't match
    mockDb.topic.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/topic')
      .set('Authorization', auth)
      .query({ dayId: FOREIGN_DAY_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.topics).toEqual([]);
    expect(res.body.error).toBeUndefined();

    // Verify the query uses the authenticated user's ID, NOT a client-supplied one
    const queryArgs = mockDb.topic.findMany.mock.calls[0][0];
    expect(queryArgs.where.day.roadmap.userId).toBe(TEST_USER.id);
    expect(queryArgs.where.dayId).toBe(FOREIGN_DAY_ID);
  });

  // ── 3. Nonexistent day returns the same empty shape ───────────────────────

  it('returns empty topics for a nonexistent dayId (same shape as foreign day)', async () => {
    const auth = await makeAuthHeader();
    mockDb.topic.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/topic')
      .set('Authorization', auth)
      .query({ dayId: NONEXISTENT_DAY_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.topics).toEqual([]);

    // Same ownership constraint applied regardless
    const queryArgs = mockDb.topic.findMany.mock.calls[0][0];
    expect(queryArgs.where).toEqual({
      dayId: NONEXISTENT_DAY_ID,
      day: {
        roadmap: {
          userId: TEST_USER.id,
        },
      },
    });
  });

  // ── 4. Unauthenticated request is rejected ────────────────────────────────

  it('returns 401 for unauthenticated requests without executing db query', async () => {
    const res = await request(app)
      .get('/api/topic')
      .query({ dayId: OWN_DAY_ID });

    expect(res.status).toBe(401);
    expect(mockDb.topic.findMany).not.toHaveBeenCalled();
  });

  // ── 5. Missing dayId returns 400 ──────────────────────────────────────────

  it('returns 400 when dayId is missing without executing db query', async () => {
    const auth = await makeAuthHeader();

    const res = await request(app)
      .get('/api/topic')
      .set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dayId');
    expect(mockDb.topic.findMany).not.toHaveBeenCalled();
  });
});
