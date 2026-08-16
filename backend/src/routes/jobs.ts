import { Router, Request, Response } from 'express';
import { aiQueue } from '../lib/queue';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/jobs/:id
router.get('/jobs/:id', async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const jobId = req.params.id as string;

  try {
    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    // IDOR Protection: SEC-7
    if (job.data.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this job.' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const error = job.failedReason;

    return res.json({
      success: true,
      job: {
        id: job.id,
        state,
        result,
        error
      }
    });
  } catch (error) {
    console.error('[api/jobs] Fetch job error:', error);
    return res.status(500).json({ error: 'Could not fetch job status.' });
  }
});

export default router;
