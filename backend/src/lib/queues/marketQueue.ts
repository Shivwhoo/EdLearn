import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { runMarketDemandScraper } from '../cronScraper';

// BullMQ needs a plain (non-TLS) Redis — BULLMQ_REDIS_URL uses local Docker
// Redis while REDIS_URL may point at TLS-only Upstash which ioredis can't use.
const REDIS_URL = process.env.BULLMQ_REDIS_URL || 'redis://localhost:6379';

function createConnection(): Redis | null {
  try {
    const conn = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    // Suppress recurring error spam — log once then silence
    let errorLogged = false;
    conn.on('error', (err) => {
      if (!errorLogged) {
        console.warn('[BullMQ] Redis unavailable — market demand queue disabled:', err.message);
        errorLogged = true;
      }
    });
    return conn;
  } catch {
    return null;
  }
}

export const startMarketWorker = async () => {
  const connection = createConnection();
  if (!connection) {
    console.warn('[BullMQ] Could not create Redis connection. Market worker disabled.');
    return null;
  }

  // Verify connection is reachable before starting worker
  try {
    await connection.connect();
  } catch {
    console.warn('[BullMQ] Redis not reachable at', REDIS_URL, '— market worker disabled.');
    connection.disconnect();
    return null;
  }

  const queue = new Queue('market-demand', { connection: connection as any });

  const worker = new Worker(
    'market-demand',
    async (job: Job) => {
      console.log(`[BullMQ] Processing market-demand job ${job.id}`);
      await runMarketDemandScraper();
    },
    { connection: connection as any }
  );

  worker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
  });

  // Schedule repeatable scrape every 6 hours
  await queue.add(
    'scrape-market-demand',
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: { age: 24 * 3600, count: 10 },
      removeOnFail: { age: 7 * 24 * 3600, count: 50 },
    }
  );

  console.log('[BullMQ] Market Demand Worker started and repeatable job scheduled.');
  return worker;
};
