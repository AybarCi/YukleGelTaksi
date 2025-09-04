import { createClient, RedisClientType } from 'redis';

class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public async connect(): Promise<RedisClientType> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      // Redis connection configuration
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Too many retry attempts');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Event listeners
      this.client.on('error', (err: any) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Redis connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }
}

// Cache utility functions
export class CacheManager {
  private redis: RedisConnection;

  constructor() {
    this.redis = RedisConnection.getInstance();
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.redis.connect();
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // Fail silently, return null if cache is unavailable
    }
  }

  /**
   * Set cached data with TTL (Time To Live)
   */
  async set(key: string, data: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false; // Fail silently
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - if data doesn't exist, execute callback and cache result
   */
  async getOrSet<T>(
    key: string, 
    callback: () => Promise<T>, 
    ttlSeconds: number = 300
  ): Promise<T | null> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, execute callback
      const data = await callback();
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttlSeconds);
      }
      
      return data;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache fails, still try to execute callback
      try {
        return await callback();
      } catch (callbackError) {
        console.error('Callback execution error:', callbackError);
        return null;
      }
    }
  }
}

// Cache key generators
export const CacheKeys = {
  // Dashboard stats
  dashboardStats: () => 'dashboard:stats',
  
  // Orders
  ordersList: (page: number, limit: number, status?: string, search?: string) => {
    const params = [page, limit, status || 'all', search || 'none'].join(':');
    return `orders:list:${params}`;
  },
  ordersCount: (status?: string, search?: string) => {
    const params = [status || 'all', search || 'none'].join(':');
    return `orders:count:${params}`;
  },
  
  // Users
  usersList: (page: number, limit: number, search?: string) => {
    const params = [page, limit, search || 'none'].join(':');
    return `users:list:${params}`;
  },
  usersCount: (search?: string) => {
    return `users:count:${search || 'none'}`;
  },
  
  // Drivers
  driversList: (page: number, limit: number, status?: string) => {
    const params = [page, limit, status || 'all'].join(':');
    return `drivers:list:${params}`;
  },
  driversCount: (status?: string) => {
    return `drivers:count:${status || 'all'}`;
  },
  
  // Support tickets
  supportTicketsList: (page: number, limit: number, status?: string) => {
    const params = [page, limit, status || 'all'].join(':');
    return `support:list:${params}`;
  },
  supportTicketsCount: (status?: string) => {
    return `support:count:${status || 'all'}`;
  }
};

// TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 900,        // 15 minutes
  VERY_LONG: 3600,  // 1 hour
  DASHBOARD: 120,   // 2 minutes for dashboard stats
  SEARCH: 180,      // 3 minutes for search results
  LIST: 300         // 5 minutes for list data
};

export default RedisConnection;