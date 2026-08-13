import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// M2: Prometheus metrics. Collects default Node.js process metrics (event
// loop lag, memory, GC) plus app-level HTTP request count/duration, scoped
// by route pattern (not raw URL, to avoid unbounded label cardinality from
// IDs in paths) and status code. Exposed at GET /metrics for scraping.

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const httpRequestErrorsTotal = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP requests that resulted in a 5xx response',
  labelNames: ['method', 'route'] as const,
  registers: [register],
});

// TTS is the one AI/media endpoint pair explicitly worth tracking
// separately (per the M2 audit) since it's the slowest, most failure-prone
// path (external Google TTS calls + storage upload).
export const ttsGenerationDurationSeconds = new client.Histogram({
  name: 'tts_generation_duration_seconds',
  help: 'Duration of TTS audio generation (synthesis + storage upload) in seconds',
  labelNames: ['route', 'outcome'] as const, // outcome: success | error
  buckets: [0.5, 1, 2, 5, 10, 20, 40, 60],
  registers: [register],
});

/**
 * Route-pattern label, e.g. "/api/topic" instead of "/api/topic?dayId=123",
 * and Express's matched pattern (req.route.path) when available instead of
 * the raw path, so per-user/per-id URLs don't create unbounded metric
 * cardinality.
 */
function routeLabel(req: Request): string {
  const matched = (req as any).route?.path;
  if (matched) {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${matched}`;
  }
  return req.path.split('?')[0];
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const endTimer = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    const route = routeLabel(req);
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
    if (res.statusCode >= 500) {
      httpRequestErrorsTotal.inc({ method: req.method, route });
    }
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export { register };
