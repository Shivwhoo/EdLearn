import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.client = createClient({ url: redisUrl });
      
      this.client.on('error', (err) => {
        console.warn('Redis Client Connection Error:', err.message || err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Successfully connected to Redis Cache server');
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
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });
    } catch (err) {
      console.warn(`Redis setCache failed for key ${key}:`, err);
    }
  }
}

export const redisCache = new RedisClient();
export default redisCache;
