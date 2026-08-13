/**
 * GDPR Router Integration Tests — /api/gdpr/*
 *
 * Covers:
 *   GET    /api/gdpr/export   — data export (requires auth)
 *   DELETE /api/gdpr/account  — account deletion (requires auth + password)
 *
 * All external deps (Prisma, Redis) are mocked in setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../middleware/auth';
import gdprRouter from '../routes/gdpr.router';

// ── Mocked modules ────────────────────────────────────────────────────────────
import db from '../lib/db';
import { redisCache } from '../lib/redis';

const mockDb = db as any;
const mockCache = redisCache as any;

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/gdpr', gdprRouter);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeAuthHeader(userId = 'gdpr-user-id') {
  mockDb.user.findUnique.mockResolvedValue({ id: userId, email: 'gdpr@example.com' });
  const { generateToken } = await import('../lib/auth');
  return `Bearer ${generateToken({ id: userId, email: 'gdpr@example.com' })}`;
}

function makeFullUser(passwordHash = 'salt:hash') {
  return {
    id: 'gdpr-user-id',
    email: 'gdpr@example.com',
    passwordHash,
    credits: 50,
    createdAt: new Date(),
    profile: { fullName: 'GDPR User' },
  };
}

// ─── GET /api/gdpr/export ─────────────────────────────────────────────────────

describe('GET /api/gdpr/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/gdpr/export');
    expect(res.status).toBe(401);
  });

  it('returns JSON download with user data when authenticated', async () => {
    const auth = await makeAuthHeader();

    // All parallel DB queries inside the export handler
    mockDb.user.findUnique.mockResolvedValue(makeFullUser());
    mockDb.roadmap.findMany.mockResolvedValue([]);
    mockDb.progress.findMany.mockResolvedValue([]);
    mockDb.vision.findMany.mockResolvedValue([]);
    mockDb.visionMilestone.findMany.mockResolvedValue([]);
    mockDb.badge.findMany.mockResolvedValue([]);
    mockDb.workspace.findUnique.mockResolvedValue(null);
    mockDb.dataExportRequest.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/gdpr/export')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.exportedAt).toBeDefined();
    expect(res.body.account.email).toBe('gdpr@example.com');
    // Audit log must be recorded
    expect(mockDb.dataExportRequest.create).toHaveBeenCalledOnce();
  });

  it('returns 404 when user record is not found', async () => {
    const auth = await makeAuthHeader();

    mockDb.user.findUnique
      // First call: authenticate middleware (must succeed to reach handler)
      .mockResolvedValueOnce({ id: 'gdpr-user-id', email: 'gdpr@example.com' })
      // Second call: inside the export handler
      .mockResolvedValueOnce(null);

    mockDb.roadmap.findMany.mockResolvedValue([]);
    mockDb.progress.findMany.mockResolvedValue([]);
    mockDb.vision.findMany.mockResolvedValue([]);
    mockDb.visionMilestone.findMany.mockResolvedValue([]);
    mockDb.badge.findMany.mockResolvedValue([]);
    mockDb.workspace.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/gdpr/export')
      .set('Authorization', auth);

    expect(res.status).toBe(404);
  });

  it('includes roadmaps and progress in export payload', async () => {
    const auth = await makeAuthHeader();

    mockDb.user.findUnique.mockResolvedValue(makeFullUser());
    mockDb.roadmap.findMany.mockResolvedValue([
      {
        id: 'rm-1',
        title: 'Learn TypeScript',
        deadline: new Date(),
        isAchievable: true,
        createdAt: new Date(),
        days: [
          {
            dayNumber: 1,
            title: 'Day 1',
            duration: 60,
            topics: [
              {
                title: 'Intro',
                mode: 1,
                completed: false,
                createdAt: new Date(),
                citations: [],
              },
            ],
          },
        ],
      },
    ]);
    mockDb.progress.findMany.mockResolvedValue([
      { dayId: 'day-1', score: 90, completedAt: new Date() },
    ]);
    mockDb.vision.findMany.mockResolvedValue([]);
    mockDb.visionMilestone.findMany.mockResolvedValue([]);
    mockDb.badge.findMany.mockResolvedValue([]);
    mockDb.workspace.findUnique.mockResolvedValue(null);
    mockDb.dataExportRequest.create.mockResolvedValue({});

    const res = await request(app)
      .get('/api/gdpr/export')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.roadmaps).toHaveLength(1);
    expect(res.body.roadmaps[0].title).toBe('Learn TypeScript');
    expect(res.body.progress).toHaveLength(1);
    expect(res.body.progress[0].score).toBe(90);
  });
});

// ─── DELETE /api/gdpr/account ─────────────────────────────────────────────────

describe('DELETE /api/gdpr/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .delete('/api/gdpr/account')
      .send({ password: 'Password123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when password is missing', async () => {
    const auth = await makeAuthHeader();

    const res = await request(app)
      .delete('/api/gdpr/account')
      .set('Authorization', auth)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password is required/i);
  });

  it('returns 403 when password is incorrect', async () => {
    const auth = await makeAuthHeader();

    // Provide a known hash that will NOT match "WrongPassword"
    mockDb.user.findUnique.mockResolvedValue(makeFullUser('salt:badhash'));

    // verifyPassword will return false for any plain text against a dummy hash

    const res = await request(app)
      .delete('/api/gdpr/account')
      .set('Authorization', auth)
      .send({ password: 'WrongPassword' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/incorrect password/i);
  });

  it('deletes account and clears Redis on correct password', async () => {
    const auth = await makeAuthHeader();

    // We need verifyPassword to return true — spy on it
    const authLib = await import('../lib/auth');
    const spy = vi.spyOn(authLib, 'verifyPassword').mockReturnValue(true);

    mockDb.user.findUnique.mockResolvedValue(makeFullUser());
    mockDb.user.delete.mockResolvedValue({});
    mockCache.deleteCache.mockResolvedValue(1);

    const res = await request(app)
      .delete('/api/gdpr/account')
      .set('Authorization', auth)
      .send({ password: 'CorrectPassword123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/permanently deleted/i);

    // Verify user was deleted
    expect(mockDb.user.delete).toHaveBeenCalledOnce();

    // Redis cleanup should have been called for at least active_roadmap key
    expect(mockCache.deleteCache).toHaveBeenCalledWith(
      expect.stringContaining('active_roadmap:'),
    );

    spy.mockRestore();
  });

  it('returns 404 when user is not found', async () => {
    const auth = await makeAuthHeader();

    mockDb.user.findUnique
      // authenticate middleware (succeeds)
      .mockResolvedValueOnce({ id: 'gdpr-user-id', email: 'gdpr@example.com' })
      // handler lookup (user deleted mid-session)
      .mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/gdpr/account')
      .set('Authorization', auth)
      .send({ password: 'Password123' });

    expect(res.status).toBe(404);
  });
});
