/**
 * Content cron scheduler — registers BullMQ repeatable jobs for the three
 * content fetchers (news / media / books), mirroring the marketQueue
 * pattern. Falls back to plain setInterval timers when Redis is
 * unavailable so content still refreshes in dev environments.
 *
 *   news  — every 3 hours
 *   media — every 6 hours
 *   books — every 24 hours
 *
 * Each fetcher is also fired once shortly after startup so a fresh
 * database gets populated immediately (fetchers no-op without API keys).
 */
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { runNewsFetch } from './newsCron';
import { runMediaFetch } from './mediaCron';
import { runBooksFetch } from './booksCron';
import { runEmailDigest } from './emailDigestCron';

const REDIS_URL = process.env.BULLMQ_REDIS_URL || 'redis://localhost:6379';

const JOBS: Array<{ name: string; everyMs: number; run: () => Promise<void> }> = [
  { name: 'fetch-news', everyMs: 3 * 60 * 60 * 1000, run: runNewsFetch },
  { name: 'fetch-media', everyMs: 6 * 60 * 60 * 1000, run: runMediaFetch },
  { name: 'fetch-books', everyMs: 24 * 60 * 60 * 1000, run: runBooksFetch },
  { name: 'email-digest', everyMs: 7 * 24 * 60 * 60 * 1000, run: runEmailDigest },
];

function startIntervalFallback(): void {
  console.warn('[ContentCrons] Redis unavailable — using in-process interval timers instead.');
  for (const job of JOBS) {
    setInterval(() => {
      job.run().catch((err) => console.error(`[ContentCrons] ${job.name} failed:`, err?.message || err));
    }, job.everyMs);
  }
}

function runAllOnceSoon(): void {
  // Small delay so the server finishes booting before we hit external APIs
  setTimeout(() => {
    for (const job of JOBS) {
      job.run().catch((err) => console.error(`[ContentCrons] Initial ${job.name} failed:`, err?.message || err));
    }
  }, 10_000);
}

export const startContentCrons = async (): Promise<Worker | null> => {
  runAllOnceSoon();

  let connection: Redis;
  try {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    let errorLogged = false;
    connection.on('error', (err) => {
      if (!errorLogged) {
        console.warn('[ContentCrons] Redis error:', err.message);
        errorLogged = true;
      }
    });
    await connection.connect();
  } catch {
    startIntervalFallback();
    return null;
  }

  const queue = new Queue('content-crons', { connection: connection as any });

  const worker = new Worker(
    'content-crons',
    async (job: Job) => {
      const def = JOBS.find((j) => j.name === job.name);
      if (!def) return;
      console.log(`[ContentCrons] Running ${job.name} (job ${job.id})`);
      await def.run();
    },
    { connection: connection as any }
  );

  worker.on('failed', (job, err) => {
    console.error(`[ContentCrons] Job ${job?.name} failed:`, err.message);
  });

  for (const job of JOBS) {
    await queue.add(
      job.name,
      {},
      {
        repeat: { every: job.everyMs },
        removeOnComplete: { age: 24 * 3600, count: 10 },
        removeOnFail: { age: 7 * 24 * 3600, count: 50 },
      }
    );
  }

  console.log('[ContentCrons] News/Media/Books repeatable jobs scheduled.');
  return worker;
};
