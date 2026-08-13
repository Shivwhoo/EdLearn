import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

// M2: Centralized structured logger. Everything important (server lifecycle,
// DB/Redis/Mongo connectivity, request logs, unhandled errors) should log
// through this instead of raw console.* so logs are structured JSON with
// levels + timestamps in production, and readably colorized in dev.
//
// This intentionally does NOT replace every console.log in the codebase —
// only the infrastructure-critical paths (see index.ts, redis.ts). Feature
// code keeps its existing console.* calls unless a specific bug requires
// touching it.

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never let secrets or PII leak into logs, even if a caller accidentally
  // logs a larger object that happens to contain one of these fields.
  redact: {
    paths: [
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'token',
      'jwt',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.apiKey',
      '*.JWT_SECRET',
      '*.SSO_SHARED_SECRET',
      '*.GROQ_API_KEY',
      '*.GEMINI_API_KEY',
      '*.GOOGLE_CLIENT_SECRET',
      '*.S3_SECRET_ACCESS_KEY',
    ],
    censor: '[REDACTED]',
  },
  ...(isProd
    ? {}
    : {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    }),
});

/**
 * Express request-logging middleware. Assigns/propagates a per-request
 * correlation id (X-Request-Id if the caller sent one, otherwise a fresh
 * UUID) so a single request's logs — including anything logged deeper in
 * the call stack via req.log — can be traced together.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

export default logger;
