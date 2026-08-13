/**
 * TOTP (Time-based One-Time Password) helpers for 2FA.
 *
 * Uses the `otplib` package which implements RFC 6238 (TOTP).
 * Compatible with Google Authenticator, Authy, and any standard TOTP app.
 *
 * NOTE: otplib v13 removed the class-based `authenticator` object in favour
 * of standalone functions. This module wraps those functions to preserve the
 * same public interface used by auth.router.ts.
 */

import * as otplib from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

const APP_NAME = process.env.APP_NAME || 'EdLearn';

// ─── Secret generation ────────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret (base32 encoded, 20 bytes).
 */
export function generateTotpSecret(): string {
  return (otplib as any).generateSecret
    ? (otplib as any).generateSecret(20)
    : crypto.randomBytes(20).toString('base64').replace(/[^A-Z2-7]/gi, '').toUpperCase().slice(0, 32);
}

/**
 * Build the `otpauth://` URI used to populate authenticator apps.
 */
export function buildOtpAuthUri(email: string, secret: string): string {
  // otplib v13 uses generateURI for otpauth URIs
  const generateURI = (otplib as any).generateURI;
  if (generateURI) {
    return generateURI({ type: 'totp', label: email, issuer: APP_NAME, secret });
  }
  // Fallback manual construction (RFC 6238 / Google Authenticator compatible)
  const label = encodeURIComponent(`${APP_NAME}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Render the otpauth URI as a data-URL PNG QR code (for setup flow).
 */
export async function generateQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const uri = buildOtpAuthUri(email, secret);
  return QRCode.toDataURL(uri);
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Verify a 6-digit TOTP code against the secret.
 * Returns `true` if the code is valid within ±1 step (30-second window on each side).
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    // otplib v13 standalone verify function
    const verify = (otplib as any).verify;
    if (verify) {
      return verify({ token, secret, type: 'totp', window: 1 });
    }
    // Manual TOTP verification fallback using Node crypto
    return manualTotpVerify(token, secret);
  } catch {
    return false;
  }
}

/**
 * Manual TOTP verification using Node crypto (RFC 6238 compliant).
 * Window of ±1 step (allows 30 seconds clock drift).
 */
function manualTotpVerify(token: string, secret: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (hotp(secret, counter + i) === token) return true;
  }
  return false;
}

/** RFC 4226 HOTP with 6 digits. */
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/** Minimal base32 decode (RFC 4648). */
function base32Decode(encoded: string): Buffer {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ─── Backup / recovery codes ──────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5; // 10 hex chars per code

/**
 * Generate a set of single-use backup recovery codes.
 * Returns an object with:
 *   - `plain`: codes to show to the user once (save these!)
 *   - `hashed`: SHA-256 hex values to store in the DB
 */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase();
    // Format as XXXXX-XXXXX for readability
    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
    plain.push(formatted);
    hashed.push(hashBackupCode(formatted));
  }

  return { plain, hashed };
}

/**
 * Hash a backup code for storage (SHA-256, no salt needed — codes are long enough).
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
}

/**
 * Verify a user-supplied backup code against the list of hashed codes stored in DB.
 * Returns the index of the matched code (so caller can remove it), or -1 if no match.
 */
export function verifyBackupCode(suppliedCode: string, hashedCodes: string[]): number {
  const suppliedHash = hashBackupCode(suppliedCode);
  return hashedCodes.findIndex((h) => h === suppliedHash);
}
