import { createClient, RedisClientType } from 'redis';

class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType | null = null;

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public async connect(): Promise<RedisClientType> {
    if (this.client) {
      return this.client;
    }

    // Redis connection configuration
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) return new Error('Too many retries');
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });

    this.client.on('end', () => {
      console.log('Redis Client Disconnected');
    });

    try {
      await this.client.connect();
    } catch (error) {
      console.error('Redis connection error:', error);
    }

    return this.client;
  }
}

// Cache TTL constants
export const CacheTTL = {
  SHORT: 300,    // 5 minutes
  MEDIUM: 900,   // 15 minutes
  LONG: 3600,    // 1 hour
  LIST: 600      // 10 minutes for lists
};

// Cache key generators
export const CacheKeys = {
  ordersList: (page: number, limit: number, status: string, search: string) => 
    `orders:list:${page}:${limit}:${status}:${search}`,
  ordersCount: (status: string, search: string) => 
    `orders:count:${status}:${search}`,
  order: (id: string) => `order:${id}`,
  driver: (id: string) => `driver:${id}`,
  user: (id: string) => `user:${id}`,
  usersList: (page: number, limit: number, search: string) => 
    `users:list:${page}:${limit}:${search}`,
  usersCount: (search: string) => `users:count:${search}`
};

// Cache Manager class
export class CacheManager {
  private redis: RedisConnection;

  constructor() {
    this.redis = RedisConnection.getInstance();
  }

  async get(key: string): Promise<any> {
    try {
      const client = await this.redis.connect();
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = CacheTTL.MEDIUM): Promise<void> {
    try {
      const client = await this.redis.connect();
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = await this.redis.connect();
      await client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(pattern: string): Promise<void> {
    try {
      const client = await this.redis.connect();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export default RedisConnection;