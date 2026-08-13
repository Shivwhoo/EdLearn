/**
 * Content Routes Integration Tests
 *
 * Tests the Zod-validated query-param middleware on:
 *   GET /api/books
 *   GET /api/media
 *   GET /api/news
 *
 * Prisma is mocked in setup.ts so no real DB is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

import booksRouter from '../routes/books';
import mediaRouter from '../routes/media';
import newsRouter from '../routes/news';

// ── Mocked modules ────────────────────────────────────────────────────────────
import db from '../lib/db';

const mockDb = db as any;

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/books', booksRouter);
app.use('/api/media', mediaRouter);
app.use('/api/news', newsRouter);

// ─── Books ────────────────────────────────────────────────────────────────────

describe('GET /api/books', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.bookSummary = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
  });

  it('returns 200 with default pagination', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('returns 200 with valid category filter', async () => {
    const res = await request(app).get('/api/books?category=tech');
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid category value', async () => {
    const res = await request(app).get('/api/books?category=fiction');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid query/i);
    expect(res.body.details.category).toBeDefined();
  });

  it('returns 400 for invalid sort value', async () => {
    const res = await request(app).get('/api/books?sort=random');
    expect(res.status).toBe(400);
    expect(res.body.details.sort).toBeDefined();
  });

  it('returns 400 when limit exceeds 50', async () => {
    const res = await request(app).get('/api/books?limit=100');
    expect(res.status).toBe(400);
    expect(res.body.details.limit).toBeDefined();
  });

  it('returns 400 when page is less than 1', async () => {
    const res = await request(app).get('/api/books?page=0');
    expect(res.status).toBe(400);
    expect(res.body.details.page).toBeDefined();
  });

  it('returns 400 for search query exceeding 200 chars', async () => {
    const longSearch = 'a'.repeat(201);
    const res = await request(app).get(`/api/books?search=${longSearch}`);
    expect(res.status).toBe(400);
    expect(res.body.details.search).toBeDefined();
  });

  it('passes valid category, sort, page, limit, and search', async () => {
    const res = await request(app).get(
      '/api/books?category=business&sort=newest&page=2&limit=10&search=leadership',
    );
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
  });

  it('returns 200 with category=all (should not filter)', async () => {
    const res = await request(app).get('/api/books?category=all');
    expect(res.status).toBe(200);
  });
});

// ─── Media ────────────────────────────────────────────────────────────────────

describe('GET /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.mediaContent = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
  });

  it('returns 200 with default pagination', async () => {
    const res = await request(app).get('/api/media');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('returns 400 for invalid type value', async () => {
    const res = await request(app).get('/api/media?type=podcast');
    expect(res.status).toBe(400);
    expect(res.body.details.type).toBeDefined();
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app).get('/api/media?category=sports');
    expect(res.status).toBe(400);
    expect(res.body.details.category).toBeDefined();
  });

  it('accepts valid type=video', async () => {
    const res = await request(app).get('/api/media?type=video');
    expect(res.status).toBe(200);
  });

  it('accepts valid type=audio', async () => {
    const res = await request(app).get('/api/media?type=audio');
    expect(res.status).toBe(200);
  });

  it('returns 400 when limit exceeds 50', async () => {
    const res = await request(app).get('/api/media?limit=999');
    expect(res.status).toBe(400);
  });

  it('passes combined valid filters', async () => {
    const res = await request(app).get('/api/media?category=tech&type=video&page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
  });
});

// ─── News ─────────────────────────────────────────────────────────────────────

describe('GET /api/news', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.newsArticle = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
  });

  it('returns 200 with default pagination', async () => {
    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('returns 400 for invalid timeframe value', async () => {
    const res = await request(app).get('/api/news?timeframe=daily');
    expect(res.status).toBe(400);
    expect(res.body.details.timeframe).toBeDefined();
  });

  it('accepts valid timeframe=week', async () => {
    const res = await request(app).get('/api/news?timeframe=week');
    expect(res.status).toBe(200);
  });

  it('accepts valid timeframe=3months', async () => {
    const res = await request(app).get('/api/news?timeframe=3months');
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app).get('/api/news?category=politics');
    expect(res.status).toBe(400);
    expect(res.body.details.category).toBeDefined();
  });

  it('accepts valid category=finance', async () => {
    const res = await request(app).get('/api/news?category=finance');
    expect(res.status).toBe(200);
  });

  it('returns 400 when limit exceeds 50', async () => {
    const res = await request(app).get('/api/news?limit=51');
    expect(res.status).toBe(400);
  });

  it('passes all valid filters', async () => {
    const res = await request(app).get(
      '/api/news?category=tech&timeframe=month&page=3&limit=15&search=AI',
    );
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.limit).toBe(15);
  });
});
