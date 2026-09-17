import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisCache } from '../lib/redis';
import { Request } from 'express';
import { AuthenticatedRequest } from './auth';
import { logger } from '../lib/logger';

// Helper to safely get the store, with graceful fallback if Redis is down.
const getRedisStore = (prefix: string) => {
  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      const client = redisCache.getClient();
      if (client && redisCache.connected) {
        // We cast to any because redis client's sendCommand expects an array of strings,
        // but rate-limit-redis passes them as rest arguments.
        return client.sendCommand(args as any);
      }
      // If Redis is not connected, fail the store call. 
      // express-rate-limit's passOnStoreError=true will catch this and allow the request.
      throw new Error('Redis is not connected');
    },
    prefix,
  });
};

/**
 * 1. AUTH LIMITER
 * Applied to public auth endpoints (login, signup, forgot-password).
 * Limits by IP address.
 * Standard: 10 requests per 15 minutes.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  store: getRedisStore('rl:auth:'),
  passOnStoreError: true, // Fail-open: allow request if Redis is down
});

/**
 * 2. AI GENERATION LIMITER
 * Applied to high-cost AI endpoints (generate, roadmap).
 * Limits by authenticated user ID (to prevent IP blocking for NATs).
 * Standard: 20 requests per minute per user.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation requests. Please slow down.' },
  store: getRedisStore('rl:ai:'),
  keyGenerator: (req: Request) => {
    // Rely on authenticated user ID since these routes are protected
    return (req as AuthenticatedRequest).user?.id || req['ip'] || 'unknown';
  },
  passOnStoreError: true,
});

/**
 * 3. 2FA / SENSITIVE LIMITER
 * Applied to 2FA verification and password resets.
 * Extremely strict to prevent brute-forcing short codes.
 * Standard: 5 requests per 5 minutes.
 */
export const strictAuthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
  store: getRedisStore('rl:strict:'),
  passOnStoreError: true,
});
