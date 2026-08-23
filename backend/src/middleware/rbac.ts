import { Request, Response, NextFunction } from 'express';
import db from '../lib/db';
import { AuthenticatedRequest } from './auth';

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

export function requireRole(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      const role = (user.role || 'USER') as UserRole;
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          error: 'Access denied. You do not have sufficient permissions to access this resource.',
        });
      }

      next();
    } catch (error) {
      console.error('[RBAC] Role verification error:', error);
      return res.status(500).json({ error: 'Failed to verify user authorization level.' });
    }
  };
}
