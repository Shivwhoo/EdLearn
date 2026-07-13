import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';
import { db } from '../lib/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Express middleware to authenticate API requests checking for JWT bearer tokens.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Missing authorization token.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Access denied. Token is expired or invalid.' });
  }

  // Verify the user actually exists in the database to prevent orphaned/ghost JWTs
  try {
    const userExists = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true }
    });
    if (!userExists) {
      return res.status(401).json({ error: 'Session expired. Please sign up or log in again.' });
    }
  } catch (dbErr) {
    console.error('Auth middleware database verification failed:', dbErr);
    return res.status(500).json({ error: 'Authentication database verification failed.' });
  }

  (req as AuthenticatedRequest).user = decoded;
  next();
}
