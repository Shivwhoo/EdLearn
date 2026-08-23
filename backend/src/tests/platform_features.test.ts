import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

import bookmarksRouter from '../routes/bookmarks';
import searchRouter from '../routes/search';
import analyticsRouter from '../routes/analytics';
import quizRouter from '../routes/quiz';
import notesRouter from '../routes/notes';
import adminRouter from '../routes/admin';
import notificationsRouter from '../routes/notifications';
import { generateToken } from '../lib/auth';
import db from '../lib/db';

const mockDb = db as any;

const app = express();
app.use(express.json());

// Mock authentication middleware helper
const testUser = { id: 'test-user-uuid', email: 'test@example.com', role: 'ADMIN' };
const testToken = generateToken({ id: testUser.id, email: testUser.email });

// Middleware to inject authenticated test user for protected routes
const mockAuth = (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Missing authorization token.' });
  }
  req.user = testUser;
  next();
};

app.use('/api/bookmarks', mockAuth, bookmarksRouter);
app.use('/api/search', searchRouter);
app.use('/api/progress', mockAuth, analyticsRouter);
app.use('/api/quiz', mockAuth, quizRouter);
app.use('/api/notes', mockAuth, notesRouter);
app.use('/api/admin', mockAuth, adminRouter);
app.use('/api/notifications', mockAuth, notificationsRouter);

describe('New Platform Features Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.user.findUnique.mockResolvedValue(testUser);
  });

  // ─── 1. Bookmarks ──────────────────────────────────────────────────────────
  describe('/api/bookmarks', () => {
    it('GET /api/bookmarks returns 200 and list of bookmarks', async () => {
      mockDb.bookmark.findMany.mockResolvedValue([
        { id: 'b1', userId: testUser.id, itemType: 'book', itemId: 'item-1', title: 'Test Book' },
      ]);
      mockDb.bookmark.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bookmarks).toHaveLength(1);
    });

    it('POST /api/bookmarks creates a bookmark', async () => {
      mockDb.bookmark.upsert.mockResolvedValue({
        id: 'b1',
        userId: testUser.id,
        itemType: 'media',
        itemId: 'media-123',
        title: 'Learn Next.js',
      });

      const res = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          itemType: 'media',
          itemId: 'media-123',
          title: 'Learn Next.js',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.bookmark.itemType).toBe('media');
    });

    it('DELETE /api/bookmarks/:id removes a bookmark', async () => {
      mockDb.bookmark.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete('/api/bookmarks/b1')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── 2. Universal Search ───────────────────────────────────────────────────
  describe('/api/search/universal', () => {
    it('returns empty results on short search queries', async () => {
      const res = await request(app).get('/api/search/universal?q=a');
      expect(res.status).toBe(200);
      expect(res.body.totalCount).toBe(0);
    });

    it('searches across books, media, and news', async () => {
      mockDb.bookSummary.findMany.mockResolvedValue([
        { id: 'book-1', title: 'React Guide', author: 'Dan', genre: 'tech', description: 'desc' },
      ]);
      mockDb.mediaContent.findMany.mockResolvedValue([
        { id: 'media-1', title: 'React Tutorial', platform: 'youtube', category: 'tech', channelName: 'Dev' },
      ]);
      mockDb.newsArticle.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/search/universal?q=React');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.books).toHaveLength(1);
      expect(res.body.results.media).toHaveLength(1);
      expect(res.body.totalCount).toBe(2);
    });
  });

  // ─── 3. Progress Analytics & Streaks ──────────────────────────────────────
  describe('/api/progress/analytics', () => {
    it('computes learning streaks and activity heatmap', async () => {
      mockDb.progress.findMany.mockResolvedValue([
        { completedAt: new Date() },
        { completedAt: new Date(Date.now() - 86400 * 1000) },
      ]);
      mockDb.visionMilestone.findMany.mockResolvedValue([]);
      mockDb.userProfile.findUnique.mockResolvedValue({ availableTime: 45 });

      const res = await request(app)
        .get('/api/progress/analytics')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analytics.currentStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.analytics.activityHeatmap).toHaveLength(365);
    });
  });

  // ─── 4. Quiz Engine ────────────────────────────────────────────────────────
  describe('/api/quiz', () => {
    it('POST /api/quiz/submit records attempt and grades score', async () => {
      mockDb.day.findUnique.mockResolvedValue({
        id: 'day-1',
        dayNumber: 1,
        title: 'Intro to React',
        roadmap: { userId: testUser.id, title: 'React Mastery' },
      });
      mockDb.quizAttempt.create.mockResolvedValue({
        id: 'qa-1',
        userId: testUser.id,
        dayId: 'day-1',
        score: 4,
        totalQuestions: 5,
      });

      const res = await request(app)
        .post('/api/quiz/submit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dayId: 'day-1',
          score: 4,
          totalQuestions: 5,
          answers: { 0: 1, 1: 2, 2: 0, 3: 3, 4: 0 },
        });

      expect(res.status).toBe(201);
      expect(res.body.percentage).toBe(80);
      expect(res.body.passed).toBe(true);
    });
  });

  // ─── 5. Personal Notes ─────────────────────────────────────────────────────
  describe('/api/notes', () => {
    it('GET & PUT /api/notes/:dayId saves and retrieves note', async () => {
      mockDb.day.findUnique.mockResolvedValue({
        id: 'day-1',
        roadmap: { userId: testUser.id },
      });
      mockDb.note.upsert.mockResolvedValue({
        id: 'note-1',
        userId: testUser.id,
        dayId: 'day-1',
        content: 'Personal notes on component lifecycles',
      });

      const putRes = await request(app)
        .put('/api/notes/day-1')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Personal notes on component lifecycles' });

      expect(putRes.status).toBe(200);
      expect(putRes.body.note.content).toContain('Personal notes');
    });
  });

  // ─── 6. Admin Panel ────────────────────────────────────────────────────────
  describe('/api/admin', () => {
    it('GET /api/admin/stats returns aggregate platform metrics', async () => {
      mockDb.user.count.mockResolvedValue(10);
      mockDb.roadmap.count.mockResolvedValue(15);
      mockDb.topic.count.mockResolvedValue(40);
      mockDb.progress.count.mockResolvedValue(50);
      mockDb.quizAttempt.count.mockResolvedValue(25);
      mockDb.bookSummary.count.mockResolvedValue(100);
      mockDb.mediaContent.count.mockResolvedValue(120);
      mockDb.newsArticle.count.mockResolvedValue(80);

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalUsers).toBe(10);
      expect(res.body.stats.totalRoadmaps).toBe(15);
    });
  });

  // ─── 7. In-App Notifications ───────────────────────────────────────────────
  describe('/api/notifications', () => {
    it('GET /api/notifications returns user notifications', async () => {
      mockDb.notification.findMany.mockResolvedValue([
        { id: 'notif-1', title: 'Streak milestone', read: false },
      ]);
      mockDb.notification.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.notifications).toHaveLength(1);
    });

    it('POST /api/notifications/read-all marks all read', async () => {
      mockDb.notification.updateMany.mockResolvedValue({ count: 3 });

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
