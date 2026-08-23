import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Re-use redis configuration pattern
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

export const queueConnection = new IORedis(redisOptions);

const queueConfig: QueueOptions = {
  connection: queueConnection as any,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
};

export const aiQueue = new Queue('ai-generation', queueConfig);

export async function enqueueAITask(jobName: string, payload: any, userId: string) {
  // Pass userId in the job payload for IDOR protection on polling
  return await aiQueue.add(jobName, { ...payload, userId });
}
