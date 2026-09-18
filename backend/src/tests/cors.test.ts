import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Before importing app, we configure the environment variable read by index.ts
// at module initialization.
const TEST_ORIGIN = 'http://localhost:3000';
process.env.FRONTEND_URL = TEST_ORIGIN;

// Import the Express app. 
// Because NODE_ENV = 'test' (set in setup.ts), it won't call app.listen().
import app from '../index';

describe('F-04 CORS Configuration', () => {
  it('A. Allowed origin should receive Access-Control-Allow-Origin and Credentials headers', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', TEST_ORIGIN);
    
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('B. Unauthorized origin should NOT receive Access-Control-Allow-Origin', async () => {
    const maliciousOrigin = 'https://evil-hacker.com';
    const res = await request(app)
      .get('/api/health')
      .set('Origin', maliciousOrigin);
    
    // Express CORS middleware will omit the header entirely for unauthorized origins
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('C. Preflight allowed origin should receive CORS headers', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', TEST_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');
    
    // The preflight should successfully return the expected CORS headers
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    
    // The allowed methods string will contain GET, POST, etc.
    expect(res.headers['access-control-allow-methods']).toBeDefined();
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });

  it('D. Preflight unauthorized origin should NOT receive CORS headers', async () => {
    const maliciousOrigin = 'https://evil-hacker.com';
    const res = await request(app)
      .options('/api/health')
      .set('Origin', maliciousOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');
    
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
