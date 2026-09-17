import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authLimiter, strictAuthLimiter, aiLimiter } from '../middleware/rateLimiter';
import { redisCache } from '../lib/redis';

// Mock Redis Client
vi.mock('../lib/redis', () => {
  const mockClient = {
    sendCommand: vi.fn().mockImplementation(async (args: any[]) => {
      if (args[0] === 'SCRIPT') return 'fakesha';
      return [1, 1000];
    }),
  };
  const mCache = {
    getClient: vi.fn(() => mockClient),
    get connected() { return true; },
  };
  return {
    redisCache: mCache,
    default: mCache,
  };
});

describe('F-03 Rate Limiter Middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock redis store fallback
    const mockClient = {
      sendCommand: vi.fn().mockImplementation(async (args: any[]) => {
        // Mock the loadIncrementScript / increment response
        // rate-limit-redis uses SCRIPT LOAD and EVALSHA.
        // If args[0] is 'SCRIPT', return a fake sha.
        if (args[0] === 'SCRIPT') return 'fakesha';
        // Otherwise it's EVALSHA. Return [count, ttl]
        return [1, 1000];
      }),
    };
    (redisCache.getClient as any).mockReturnValue(mockClient);

    app = express();
    app.set('trust proxy', 1); // Mock IPs
    app.use(express.json());

    // Test routes
    app.post('/auth', authLimiter, (req, res) => { res.json({ success: true }); });
    app.post('/strict', strictAuthLimiter, (req, res) => { res.json({ success: true }); });
    app.post('/ai', (req, res, next) => {
      // Mock authenticated user context
      (req as any).user = { id: req.headers['x-user-id'] || 'anon' };
      next();
    }, aiLimiter, (req, res) => { res.json({ success: true }); });
  });

  describe('authLimiter (IP based)', () => {
    it('allows requests below limit (10)', async () => {
      // Because we mocked sendCommand to return null, the store doesn't accurately track count in memory for this test.
      // Wait, rate-limit-redis needs the Lua script to return array [count, ttl].
      // Since mock returns null, it might fail to parse or just let it through.
      // To properly test the limiter logic without real Redis, we can mock sendCommand correctly, or test fallback behavior.
      
      const mockClient = {
        sendCommand: vi.fn().mockImplementation(async (args: any[]) => {
          // Mock the Lua script response for rate-limit-redis: [count, ttl]
          // args = ['EVALSHA', sha, keys..., args...]
          return [1, 1000]; // 1 request, 1000ms TTL
        }),
      };
      (redisCache.getClient as any).mockReturnValue(mockClient);

      const res = await request(app).post('/auth').set('X-Forwarded-For', '1.1.1.1');
      expect(res.status).toBe(200);
      expect(mockClient.sendCommand).toHaveBeenCalled();
    });

    it('returns 429 when limit exceeded', async () => {
      const mockClient = {
        sendCommand: vi.fn().mockImplementation(async () => {
          return [11, 1000]; // 11 hits, limit is 10
        }),
      };
      (redisCache.getClient as any).mockReturnValue(mockClient);

      const res = await request(app).post('/auth').set('X-Forwarded-For', '2.2.2.2');
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/authentication/i);
    });

    it('fails open when Redis throws', async () => {
      const mockClient = {
        sendCommand: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
      };
      (redisCache.getClient as any).mockReturnValue(mockClient);

      const res = await request(app).post('/auth').set('X-Forwarded-For', '3.3.3.3');
      expect(res.status).toBe(200); // Fail-open behavior
    });
  });

  describe('aiLimiter (User based)', () => {
    it('returns 429 when AI limit exceeded by user', async () => {
      const mockClient = {
        sendCommand: vi.fn().mockImplementation(async () => {
          return [21, 1000]; // 21 hits, limit is 20
        }),
      };
      (redisCache.getClient as any).mockReturnValue(mockClient);

      const res = await request(app)
        .post('/ai')
        .set('x-user-id', 'user-123')
        .set('X-Forwarded-For', '4.4.4.4');

      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/AI/i);
    });
  });
});
