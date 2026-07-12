import jwt from 'jsonwebtoken';

// Separate secret from JWT_SECRET on purpose: this token has a different job
// (a one-time handoff to another app, not an EdLearn session), so a leak of
// one secret must not compromise the other.
const SSO_SHARED_SECRET = process.env.SSO_SHARED_SECRET;
if (!SSO_SHARED_SECRET) {
  throw new Error('FATAL: SSO_SHARED_SECRET environment variable is not set. Server cannot start without it.');
}

// Short expiry on purpose — this is a one-time "door key" for handing a
// session to another app, not a session token itself. It should be consumed
// within seconds of being minted.
const HANDOFF_TOKEN_TTL = '90s';

export type SsoApp = 'edmentor' | 'edcompass' | 'edquiz';

export interface HandoffPayload {
  email: string;
  name: string;
  app: SsoApp;
  topic?: string;
}

export interface DecodedHandoffPayload extends HandoffPayload {
  iat: number;
  exp: number;
}

/**
 * Destination base URLs for each sibling app. Override via env if a
 * staging URL is needed while testing (e.g. EDQUIZ_URL=https://staging...).
 * Defaults point at the real production apps — do not test against these
 * directly; use a staging override until the integration is confirmed safe.
 */
const APP_BASE_URLS: Record<SsoApp, string> = {
  edmentor: process.env.EDMENTOR_URL || 'https://theedmentor.com',
  edcompass: process.env.EDCOMPASS_URL || 'https://theedcompass.com',
  edquiz: process.env.EDQUIZ_URL || 'https://edquiz.theedmentor.com',
};

/**
 * Mints a short-lived, signed handoff token so a user already logged into
 * EdLearn isn't asked to log in again on EdMentor / EdCompass / EdQuiz.
 *
 * IMPORTANT: this only mints the token. The receiving app must independently
 * verify it with the same SSO_SHARED_SECRET and establish its own session —
 * that half of the integration lives in EdMentor/EdCompass/EdQuiz's own
 * codebases, not here.
 */
export function generateHandoffToken(payload: HandoffPayload): string {
  return jwt.sign(payload, SSO_SHARED_SECRET!, { expiresIn: HANDOFF_TOKEN_TTL });
}

/**
 * Verifies a handoff token and returns the decoded payload, or null if it's
 * missing, invalid, expired, or signed with the wrong secret.
 * Exists mainly for local testing of the mint step — the real verification
 * that matters happens on the receiving app's side.
 */
export function verifyHandoffToken(token: string): DecodedHandoffPayload | null {
  try {
    return jwt.verify(token, SSO_SHARED_SECRET!) as DecodedHandoffPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Builds the full destination URL to redirect the browser to, with the
 * handoff token (and, for EdQuiz, the current topic) attached as query params.
 *
 * NOTE: the "/sso" path below is a placeholder. Confirm the real entry point
 * each app expects (path name, param names) with whoever owns that app's
 * backend, then update this function — nothing else needs to change.
 */
export function buildHandoffUrl(app: SsoApp, token: string, topic?: string): string {
  const base = APP_BASE_URLS[app];
  const params = new URLSearchParams({ token, source: 'edlearn' });
  if (topic) params.set('topic', topic);
  return `${base}/sso?${params.toString()}`;
}
