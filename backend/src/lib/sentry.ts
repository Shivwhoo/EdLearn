import type { Express } from 'express';
import { logger } from './logger';

// M2: Sentry error monitoring. Entirely opt-in via SENTRY_DSN — with it
// unset (the default for local dev and any environment that hasn't been
// given a DSN), every function here is a safe no-op so nothing about
// Sentry ever blocks local development or a deploy that hasn't configured
// it yet.
//
// Required env var to enable: SENTRY_DSN
// Optional: SENTRY_ENVIRONMENT (defaults to NODE_ENV), SENTRY_TRACES_SAMPLE_RATE
// (defaults to 0.1 — 10% of transactions traced, to bound cost/volume).

let sentryEnabled = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled (SENTRY_DSN not set)');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      // Strip anything that could carry credentials or PII before it ever
      // leaves the process, in addition to whatever scrubbing the Sentry
      // dashboard/project settings already apply.
      beforeSend(event: any) {
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
          // Request bodies may contain passwords/tokens (login, signup,
          // change-password) — never forward them to Sentry.
          delete event.request.data;
        }
        return event;
      },
    });
    sentryEnabled = true;
    logger.info({ environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV }, 'Sentry initialized');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'Sentry failed to initialize — continuing without it');
    sentryEnabled = false;
  }
}

/** Registers Sentry's Express error handler. Must be called after all routes are mounted. No-op if Sentry isn't enabled. */
export function sentryErrorHandler(app: Express): void {
  if (!sentryEnabled || !Sentry) return;
  if (typeof Sentry.setupExpressErrorHandler === 'function') {
    Sentry.setupExpressErrorHandler(app);
  }
}

/** Manually reports an error to Sentry (for catch blocks outside Express's request cycle, e.g. cron jobs). No-op if Sentry isn't enabled. */
export function captureException(err: unknown): void {
  if (!sentryEnabled || !Sentry) return;
  Sentry.captureException(err);
}
