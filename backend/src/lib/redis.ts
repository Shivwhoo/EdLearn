import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 5;

  constructor() {
    this.init();
  }

  private async init() {
    const maxRetries = this.MAX_RETRIES;
    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          // M1: Reconnect with exponential backoff — up to MAX_RETRIES attempts
          reconnectStrategy: (retries: number): false | Error | number => {
            if (retries >= maxRetries) {
              logger.warn({ maxRetries }, 'Redis: Max reconnect attempts reached. Disabling cache.');
              return new Error('Redis max reconnect attempts reached'); // returning Error stops retrying
            }
            const delay = Math.min(retries * 500, 5000);
            logger.warn({ delay, attempt: retries + 1, maxRetries }, 'Redis: Reconnecting…');
            return delay;
          },
        },
      });

      this.client.on('error', (err) => {
        logger.warn({ err: err.message || err }, 'Redis Client Error');
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.retryCount = 0;
        this.isConnected = true;
        logger.info('Successfully connected to Redis Cache server');
      });

      this.client.on('reconnecting', () => {
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (err: any) {
      console.warn('Failed to initialize Redis connection:', err.message || err);
      this.isConnected = false;
    }
  }

  /**
   * Retrieves a value from the cache. Returns null if cache is inactive or key is missing.
   */
  public async getCache(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      console.warn(`Redis getCache failed for key ${key}:`, err);
      return null;
    }
  }

  /**
   * Stores a value in the cache with an optional expiration TTL.
   */
  public async setCache(key: string, value: string, ttlSeconds: number = 86400): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch (err) {
      console.warn(`Redis setCache failed for key ${key}:`, err);
    }
  }

  /**
   * Deletes a key from the cache.
   */
  public async deleteCache(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (err) {
      console.warn(`Redis deleteCache failed for key ${key}:`, err);
    }
  }

  /**
   * Returns whether the Redis client is currently connected.
   */
  public get connected(): boolean {
    return this.isConnected;
  }
}

export const redisCache = new RedisClient();
export default redisCache;
