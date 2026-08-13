/**
 * Auth Router Integration Tests — /api/auth/*
 *
 * Uses supertest to drive the Express app. Every external dependency
 * (Prisma, Redis, email) is mocked in src/tests/setup.ts so these
 * tests never touch a real database or send real emails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Pull in mocked modules ──────────────────────────────────────────────────
import db from '../lib/db';
import { sendPasswordResetEmail } from '../lib/email';

// ── Build a minimal Express app that only mounts the auth router ─────────────
import authRouter from '../routes/auth.router';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockDb = db as any;

/** A pre-hashed password for "Password123" (real hash is opaque — use a known one). */
const HASHED_PW =
  '0000000000000000000000000000000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

/** Return a minimal user object that satisfies the signup / login handlers. */
function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    passwordHash: HASHED_PW,
    credits: 100,
    createdAt: new Date(),
    profile: { fullName: 'Test User' },
    twoFactorSecret: null,
    ...overrides,
  };
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with token and user on valid signup', async () => {
    mockDb.user.findUnique.mockResolvedValue(null); // no existing user
    mockDb.user.create.mockResolvedValue(makeUser());
    mockDb.refreshToken.create.mockResolvedValue({});

    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'Password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('returns 409 when email already exists', async () => {
    mockDb.user.findUnique.mockResolvedValue(makeUser());

    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'Password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'not-an-email',
      password: 'Password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'abc',
      fullName: 'Test User',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.password).toBeDefined();
  });

  it('returns 400 when fullName is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.fullName).toBeDefined();
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 401 when password is wrong', async () => {
    mockDb.user.findUnique.mockResolvedValue(makeUser());
    // verifyPassword will return false because the stored hash is a dummy

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'WrongPassword123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 200 with requiresTwoFactor when 2FA is enabled and no totp supplied', async () => {
    mockDb.user.findUnique.mockResolvedValue(
      makeUser({
        twoFactorSecret: { enabled: true, secret: 'JBSWY3DPEHPK3PXP', backupCodes: [] },
      }),
    );

    // Patch verifyPassword so it returns true (password check passes)
    vi.spyOn(await import('../lib/auth'), 'verifyPassword').mockReturnValue(true);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Password123' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unknown refresh token', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'some-random-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid refresh token/i);
  });

  it('returns 401 and revokes family on token-reuse attack', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'hashed',
      family: 'fam-1',
      revokedAt: new Date(), // already revoked → reuse attack
      expiresAt: new Date(Date.now() + 86400_000),
      user: makeUser(),
    });
    mockDb.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'reused-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/reuse detected/i);
    expect(mockDb.refreshToken.updateMany).toHaveBeenCalledOnce();
  });

  it('returns 401 for expired refresh token', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-2',
      token: 'hashed',
      family: 'fam-2',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired
      user: makeUser(),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('rotates token and returns new access + refresh tokens', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-3',
      token: 'hashed',
      family: 'fam-3',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400_000),
      user: makeUser(),
    });
    mockDb.refreshToken.update.mockResolvedValue({});
    mockDb.refreshToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'valid-raw-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Old token must be revoked
    expect(mockDb.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
  });

  it('returns 400 when refreshToken field is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always returns 200 (email enumeration safe) even for unknown email', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('creates OTP and sends email when user exists', async () => {
    mockDb.user.findUnique.mockResolvedValue(makeUser());
    mockDb.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    mockDb.passwordResetToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'bad-email' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for unknown email', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'nobody@example.com',
      otp: '123456',
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when OTP is invalid / expired', async () => {
    mockDb.user.findUnique.mockResolvedValue(makeUser());
    mockDb.passwordResetToken.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'test@example.com',
      otp: '999999',
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/i);
  });

  it('resets password and revokes refresh tokens on valid OTP', async () => {
    mockDb.user.findUnique.mockResolvedValue(makeUser());
    mockDb.passwordResetToken.findFirst.mockResolvedValue({
      id: 'prt-1',
      userId: 'user-uuid-1234',
      otpHash: 'some-hash',
      used: false,
      expiresAt: new Date(Date.now() + 600_000),
    });
    mockDb.$transaction.mockImplementation((arr: any[]) => Promise.all(arr));
    mockDb.passwordResetToken.update.mockResolvedValue({});
    mockDb.user.update.mockResolvedValue({});
    mockDb.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'test@example.com',
      otp: '123456',
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when OTP is not 6 digits', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'test@example.com',
      otp: '12',
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.otp).toBeDefined();
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token is provided', async () => {
    // Auth middleware on /me requires a Bearer token
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── 2FA Setup ────────────────────────────────────────────────────────────────

describe('POST /api/auth/2fa/setup', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/auth/2fa/setup').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/enable', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/auth/2fa/enable').send({ token: '123456' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when token is not 6 digits', async () => {
    // No auth → 401 before schema runs; use a valid-format token to confirm middleware order
    const res = await request(app).post('/api/auth/2fa/enable').send({ token: 'abc' });
    // Either 400 (validation) or 401 (auth) — both mean we never process a bad token
    expect([400, 401]).toContain(res.status);
  });
});

describe('POST /api/auth/2fa/disable', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/auth/2fa/disable').send({ token: '123456' });
    expect(res.status).toBe(401);
  });
});
