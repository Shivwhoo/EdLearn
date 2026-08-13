/**
 * GDPR Router — /api/gdpr/*
 *
 * Endpoints:
 *   GET    /api/gdpr/export   — Download all user data as JSON (GDPR Article 20 — data portability)
 *   DELETE /api/gdpr/account  — Delete account and all associated data (GDPR Article 17 — right to erasure)
 *
 * Both routes require authentication. Account deletion requires the user's
 * current password as confirmation to prevent accidental or CSRF-triggered deletion.
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { verifyPassword } from '../lib/auth';
import db from '../lib/db';
import { redisCache } from '../lib/redis';

const router = Router();

// All GDPR endpoints require authentication
router.use(authenticate);

// ─── GET /api/gdpr/export ─────────────────────────────────────────────────────

/**
 * Export all personal data for the authenticated user as a JSON download.
 *
 * Includes: profile, roadmaps (with days & topics), progress, vision board,
 * milestones, badges, and workspace state.
 * Excludes: password hashes, refresh tokens, and internal IDs not useful to the user.
 */
router.get('/export', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;

    const [user, roadmaps, progress, visions, milestones, badges, workspace] =
      await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        }),
        db.roadmap.findMany({
          where: { userId },
          include: {
            days: {
              include: { topics: { include: { citations: true } } },
              orderBy: { dayNumber: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.progress.findMany({
          where: { userId },
          orderBy: { completedAt: 'desc' },
        }),
        db.vision.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        db.visionMilestone.findMany({
          where: { userId },
          orderBy: { sortOrder: 'asc' },
        }),
        db.badge.findMany({
          where: { userId },
          orderBy: { earnedAt: 'desc' },
        }),
        db.workspace.findUnique({ where: { userId } }),
      ]);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Record the export request in audit log
    await db.dataExportRequest.create({
      data: { userId, status: 'downloaded', completedAt: new Date() },
    });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        credits: user.credits,
      },
      profile: user.profile,
      roadmaps: roadmaps.map((r) => ({
        id: r.id,
        title: r.title,
        deadline: r.deadline,
        isAchievable: r.isAchievable,
        createdAt: r.createdAt,
        days: r.days.map((d) => ({
          dayNumber: d.dayNumber,
          title: d.title,
          durationMinutes: d.duration,
          topics: d.topics.map((t) => ({
            title: t.title,
            mode: t.mode,
            completed: t.completed,
            createdAt: t.createdAt,
            citations: t.citations.map((c) => ({
              label: c.label,
              url: c.sourceUrl,
            })),
          })),
        })),
      })),
      progress: progress.map((p) => ({
        dayId: p.dayId,
        score: p.score,
        completedAt: p.completedAt,
      })),
      visionBoard: visions.map((v) => ({
        title: v.title,
        description: v.description,
        category: v.category,
        status: v.status,
        targetDate: v.targetDate,
        createdAt: v.createdAt,
      })),
      milestones: milestones.map((m) => ({
        title: m.title,
        description: m.description,
        targetDate: m.targetDate,
        completed: m.completed,
        createdAt: m.createdAt,
      })),
      badges: badges.map((b) => ({
        title: b.title,
        description: b.description,
        earnedAt: b.earnedAt,
      })),
      workspace: workspace
        ? {
            currentDay: workspace.currentDay,
            currentMode: workspace.currentMode,
            updatedAt: workspace.updatedAt,
          }
        : null,
    };

    const filename = `edlearn-data-export-${userId.slice(0, 8)}-${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(exportPayload);
  } catch (error) {
    console.error('GDPR export error:', error);
    return res.status(500).json({ error: 'Failed to generate data export.' });
  }
});

// ─── DELETE /api/gdpr/account ─────────────────────────────────────────────────

/**
 * Permanently delete the authenticated user's account and ALL associated data.
 *
 * Requires `password` in the request body for confirmation.
 * The Prisma schema uses onDelete: Cascade on all child models, so deleting
 * the User row cascades to profile, roadmaps, progress, visions, tokens, etc.
 *
 * Redis cache keys for the user are invalidated post-deletion.
 */
router.delete('/account', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Your current password is required to delete your account.' });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(403).json({ error: 'Incorrect password. Account deletion cancelled.' });
    }

    // Delete the user — cascades to ALL child records via Prisma schema
    await db.user.delete({ where: { id: userId } });

    // Clean up Redis keys for this user
    try {
      await Promise.all([
        redisCache.deleteCache(`active_roadmap:${userId}`),
        redisCache.deleteCache(`dashboard:${userId}`),
        redisCache.deleteCache(`facts:${userId}`),
      ]);
    } catch (redisErr) {
      console.warn('Redis cleanup after account deletion (non-fatal):', redisErr);
    }

    return res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (error) {
    console.error('GDPR account deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;
