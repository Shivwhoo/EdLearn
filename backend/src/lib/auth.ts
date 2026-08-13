import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// C1: Fail fast if JWT_SECRET is not configured — never use a predictable fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}

// C2: OWASP 2023 recommends ≥310,000 iterations for PBKDF2-SHA512
const PBKDF2_ITERATIONS = 310_000;

/**
 * Hashes a plain password using Node's native crypto PBKDF2/SHA-512.
 * Output format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain password against a stored hashed password.
 * Handles both legacy (1000 iter) and current (310000 iter) hashes gracefully.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    // Try current iteration count first
    const verifyHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    if (hash === verifyHash) return true;
    // Fallback: try legacy 1000-iteration hash for existing accounts
    const legacyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === legacyHash;
  } catch (err) {
    return false;
  }
}

/**
 * Generates a signed JWT access token for a user session (short-lived: 15 minutes).
 */
export function generateToken(payload: { id: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '15m' });
}

/**
 * Verifies a JWT token and returns the decoded payload, or null if invalid.
 */
export function verifyToken(token: string): { id: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as { id: string; email: string };
  } catch (err) {
    return null;
  }
}

// ─── Refresh Token helpers ───────────────────────────────────────────────────

/**
 * Generate a cryptographically secure opaque refresh token (32 random bytes → 64 hex chars).
 * This raw value is returned to the client; only the hash is stored in the DB.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash of a refresh token for safe DB storage.
 * Never store the raw token — only this hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a UUID "family" identifier used to detect refresh-token reuse attacks.
 * All tokens in a refresh chain share the same family. If an old (revoked) token
 * is presented, the entire family is invalidated.
 */
export function generateTokenFamily(): string {
  return crypto.randomUUID();
}

// ─── OTP helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a 6-digit numeric OTP for password reset.
 */
export function generateOtp(): string {
  const otp = crypto.randomInt(100000, 999999);
  return String(otp);
}

/**
 * Hash an OTP using SHA-256 for safe DB storage.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}
