import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { runMarketDemandScraper } from '../cronScraper';

// Using the same Redis connection settings from the project's docker-compose / env
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// Create the Queue
export const marketDemandQueue = new Queue('market-demand', { connection: connection as any });

// Define the Worker
export const startMarketWorker = () => {
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
    console.error(`[BullMQ] Job ${job?.id} failed with error:`, err);
  });

  // Add the repeatable job if it's not already there
  // BullMQ uses a cron expression or specific intervals. We'll use 6 hours.
  marketDemandQueue.add(
    'scrape-market-demand',
    {},
    {
      repeat: {
        every: 6 * 60 * 60 * 1000, // 6 hours
      },
      // Keep some job history for visibility
      removeOnComplete: { age: 24 * 3600, count: 10 },
      removeOnFail: { age: 7 * 24 * 3600, count: 50 },
    }
  );

  console.log('[BullMQ] Market Demand Worker started and repeatable job scheduled.');
  return worker;
};
