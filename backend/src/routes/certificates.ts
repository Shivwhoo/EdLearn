import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../lib/db';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /api/certificates/issue
 * Verify roadmap completion and issue a certificate record.
 * Body: { roadmapId: string }
 */
router.post('/issue', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  try {
    const { roadmapId } = req.body;

    if (!roadmapId) {
      return res.status(400).json({ error: 'Missing required parameter: roadmapId.' });
    }

    const roadmap = await db.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        days: { select: { id: true } }
      }
    });

    if (!roadmap || roadmap.userId !== userId) {
      return res.status(404).json({ error: 'Roadmap not found or access denied.' });
    }

    // Verify completion
    const dayIds = roadmap.days.map(d => d.id);
    const completedProgress = await db.progress.findMany({
      where: {
        userId,
        dayId: { in: dayIds }
      },
      distinct: ['dayId']
    });

    if (completedProgress.length < dayIds.length) {
      return res.status(400).json({ error: 'Roadmap is not fully completed yet.' });
    }

    // Check if certificate already exists
    const existingCert = await db.certificate.findUnique({
      where: {
        userId_roadmapId: {
          userId,
          roadmapId
        }
      }
    });

    if (existingCert) {
      return res.json({ success: true, certificate: existingCert, message: 'Certificate already issued.' });
    }

    // Generate SHA-256 Hash
    const rawData = `${userId}-${roadmapId}-${Date.now()}`;
    const sha256Hash = crypto.createHash('sha256').update(rawData).digest('hex');

    const certificate = await db.certificate.create({
      data: {
        userId,
        roadmapId,
        sha256Hash
      }
    });

    return res.status(201).json({ success: true, certificate });
  } catch (error) {
    console.error('[api/certificates/issue] Error:', error);
    return res.status(500).json({ error: 'Failed to issue certificate.' });
  }
});

/**
 * GET /api/certificates/verify/:hash
 * Public route to verify a certificate's authenticity.
 */
router.get('/verify/:hash', async (req: Request, res: Response): Promise<any> => {
  try {
    const hash = String(req.params.hash);

    if (!hash) {
      return res.status(400).json({ error: 'Missing certificate hash.' });
    }

    const certificate: any = await db.certificate.findUnique({
      where: { sha256Hash: hash },
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
        roadmap: { select: { title: true } }
      }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found or invalid hash.' });
    }

    return res.json({
      success: true,
      data: {
        certificateId: certificate.id,
        issuedAt: certificate.issuedAt,
        studentName: certificate.user.profile?.fullName || certificate.user.email.split('@')[0],
        courseTitle: certificate.roadmap.title,
        hash: certificate.sha256Hash
      }
    });
  } catch (error) {
    console.error('[api/certificates/verify] Error:', error);
    return res.status(500).json({ error: 'Failed to verify certificate.' });
  }
});

export default router;
