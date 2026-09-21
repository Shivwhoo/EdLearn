import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import db from '../lib/db';
import { redisCache } from '../lib/redis';
import { aiService } from '../lib/ai/aiService';
import * as scraper from '../lib/scraper';

const mockDb = db as any;
const mockCache = redisCache as any;
const mockAi = aiService as any;

vi.mock('../lib/scraper', () => ({
  getReferenceContext: vi.fn().mockResolvedValue([]),
}));

async function makeAuthHeader(userId = 'user-id') {
  mockDb.user.findUnique.mockResolvedValue({ id: userId, email: 'test@example.com' });
  const { generateToken } = await import('../lib/auth');
  const token = generateToken({ id: userId, email: 'test@example.com' });
  return `Bearer ${token}`;
}

describe('POST /api/generate Context Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DSA in Python + Trees must resolve to the correct roadmap context and influence prompt', async () => {
    const auth = await makeAuthHeader('user-id');

    mockDb.day.findUnique.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      roadmap: { userId: 'user-id', title: 'DSA in Python', id: 'roadmap-456' }
    });
    mockCache.getCache.mockResolvedValue(null);
    mockAi.generate.mockResolvedValue(JSON.stringify({ title: 'Trees in DSA', contentBlocks: [] }));

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', auth)
      .send({ topic: 'Trees', mode: 1, difficulty: 'Intermediate', dayId: '550e8400-e29b-41d4-a716-446655440000' });

    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);

    // Prompt context
    const aiCallArgs = mockAi.generate.mock.calls[0];
    const userPrompt = aiCallArgs[0];
    expect(userPrompt).toContain('DSA in Python');
    expect(userPrompt).toContain('Trees');
    expect(userPrompt).toContain('Intermediate');
    expect(userPrompt).toContain('Interpret the topic strictly within the learning context above');

    // RAG context
    expect(scraper.getReferenceContext).toHaveBeenCalledWith('Trees', undefined, 'DSA in Python');

    // Cache isolation
    expect(mockCache.getCache).toHaveBeenCalledWith('notes:550e8400-e29b-41d4-a716-446655440000:trees:intermediate:1');
  });

  it('Cache isolation: Two requests with different dayIds must produce different cache keys', async () => {
    const auth = await makeAuthHeader('user-id');

    mockDb.day.findUnique.mockResolvedValueOnce({
      id: '810672e1-45fb-4974-9b5f-5ecf36f95964',
      roadmap: { userId: 'user-id', title: 'Roadmap A' }
    }).mockResolvedValueOnce({
      id: 'f56d78c0-3fb1-432d-8e4a-4d7a8d5b8823',
      roadmap: { userId: 'user-id', title: 'Roadmap B' }
    });

    mockCache.getCache.mockResolvedValue(null);
    mockAi.generate.mockResolvedValue(JSON.stringify({ title: 'Test', contentBlocks: [] }));

    const res1 = await request(app)
      .post('/api/generate')
      .set('Authorization', auth)
      .send({ topic: 'Trees', mode: 1, difficulty: 'Intermediate', dayId: '810672e1-45fb-4974-9b5f-5ecf36f95964' });
    if (res1.status !== 200) console.log(res1.body);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/generate')
      .set('Authorization', auth)
      .send({ topic: 'Trees', mode: 1, difficulty: 'Intermediate', dayId: 'f56d78c0-3fb1-432d-8e4a-4d7a8d5b8823' });
    if (res2.status !== 200) console.log(res2.body);
    expect(res2.status).toBe(200);

    expect(mockCache.getCache).toHaveBeenCalledWith('notes:810672e1-45fb-4974-9b5f-5ecf36f95964:trees:intermediate:1');
    expect(mockCache.getCache).toHaveBeenCalledWith('notes:f56d78c0-3fb1-432d-8e4a-4d7a8d5b8823:trees:intermediate:1');
  });

  it('Authorization check: A user must not be able to use another user\'s dayId', async () => {
    const auth = await makeAuthHeader('user-id'); // auth is for 'user-id'

    // The day belongs to 'other-user'
    mockDb.day.findUnique.mockResolvedValue({
      id: 'a9c372f8-0f09-4e78-8316-2d93cb566e94',
      roadmap: { userId: 'other-user', title: 'Other Roadmap' }
    });

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', auth)
      .send({ topic: 'Trees', mode: 1, difficulty: 'Intermediate', dayId: 'a9c372f8-0f09-4e78-8316-2d93cb566e94' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
    expect(mockAi.generate).not.toHaveBeenCalled();
  });
});
