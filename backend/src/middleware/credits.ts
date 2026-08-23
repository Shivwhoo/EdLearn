import { Request, Response, NextFunction } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware to check and optionally deduct AI credits.
 * By default, users have 15 free credits.
 */
export function guardCredits(cost: number = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      if (user.credits < cost) {
        return res.status(402).json({
          error: 'Insufficient AI credits. Please upgrade your plan or wait for your daily balance reset.',
          credits: user.credits,
          required: cost,
        });
      }

      next();
    } catch (error) {
      console.error('[CreditGuard] Error checking credits:', error);
      return res.status(500).json({ error: 'Failed to verify user credit balance.' });
    }
  };
}
