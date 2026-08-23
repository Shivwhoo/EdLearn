/**
 * Test setup — runs before every test file.
 *
 * 1. Sets required environment variables so modules that fail-fast on missing
 *    secrets (e.g. lib/auth.ts checks JWT_SECRET at import time) don't throw.
 * 2. Mocks the Prisma DB client so tests never need a real PostgreSQL connection.
 * 3. Mocks ioredis so tests never need a real Redis connection.
 * 4. Mocks the email service so tests don't send real emails.
 */

import { vi, beforeAll, afterEach } from 'vitest';

// ─── 1. Env vars ─────────────────────────────────────────────────────────────

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long-for-tests';
process.env.SSO_SHARED_SECRET = 'test-sso-secret';
process.env.NODE_ENV = 'test';
// No SMTP_HOST → email service console.logs instead of sending
delete process.env.SMTP_HOST;

// ─── 2. Mock Prisma DB ────────────────────────────────────────────────────────

vi.mock('../lib/db', () => {
  const mockDb = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    roadmap: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    day: {
      findUnique: vi.fn(),
    },
    topic: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    progress: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    badge: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    twoFactorSecret: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    dataExportRequest: {
      create: vi.fn(),
    },
    // Vision Board — full CRUD set needed by visionBoard router + GDPR tests
    vision: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    visionMilestone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspace: { findUnique: vi.fn() },
    citation: {},
    // Content tables — mocked for books/media/news route tests
    bookSummary: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    mediaContent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    newsArticle: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    bookmark: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({ id: 'b-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    quizAttempt: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'q-1', score: 5, totalQuestions: 5 }),
    },
    note: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'n-1', content: 'notes' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((arr: any[]) => Promise.all(arr)),
  };

  return { default: mockDb, db: mockDb };
});

// ─── 3. Mock ioredis ─────────────────────────────────────────────────────────

vi.mock('../lib/redis', () => ({
  redisCache: {
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue('OK'),
    deleteCache: vi.fn().mockResolvedValue(1),
  },
}));

// ─── 4. Mock email service ───────────────────────────────────────────────────

vi.mock('../lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── 5. Mock AI service (for generate/roadmap integration tests) ─────────────

vi.mock('../lib/ai/aiService', () => ({
  aiService: {
    generate: vi.fn().mockResolvedValue(JSON.stringify({
      title: 'Test Roadmap',
      isAchievable: true,
      feasibilityNote: 'OK',
      days: [{ dayNumber: 1, title: 'Day 1', durationMinutes: 60 }],
    })),
    getActiveProviderName: vi.fn().mockReturnValue('mock'),
  },
}));

// ─── 6. Clear all mocks between tests ────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});
