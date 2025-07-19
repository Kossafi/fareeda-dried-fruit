import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';

// Prisma Client for PostgreSQL
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout', 
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
});

// Redis Client for caching and real-time features
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Logger configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stock-management-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Database connection handlers
export const connectDatabase = async (): Promise<void> => {
  try {
    // Test Prisma connection
    await prisma.$connect();
    logger.info('PostgreSQL connected successfully');

    // Test Redis connection
    redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    await redis.connect();

    // Enable Prisma query logging in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Query:', e.query);
        logger.debug('Params:', e.params);
        logger.debug('Duration:', e.duration + 'ms');
      });
    }

  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    await redis.disconnect();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};

// Health check functions
export const checkDatabaseHealth = async (): Promise<{
  postgres: boolean;
  redis: boolean;
}> => {
  const health = {
    postgres: false,
    redis: false
  };

  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    health.postgres = true;
  } catch (error) {
    logger.error('PostgreSQL health check failed:', error);
  }

  try {
    // Check Redis
    await redis.ping();
    health.redis = true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
  }

  return health;
};

// Cache helpers for frequently accessed data
export const cacheKeys = {
  stockLevel: (branchId: string, productId: string) => `stock:${branchId}:${productId}`,
  lowStockAlerts: (branchId: string) => `alerts:low-stock:${branchId}`,
  salesPattern: (branchId: string, date: string) => `sales:pattern:${branchId}:${date}`,
  productInfo: (productId: string) => `product:${productId}`,
  branchInfo: (branchId: string) => `branch:${branchId}`,
  userSession: (userId: string) => `session:${userId}`,
};

// Cache TTL settings (in seconds)
export const cacheTTL = {
  stockLevel: 300,      // 5 minutes
  lowStockAlerts: 600,  // 10 minutes
  salesPattern: 3600,   // 1 hour
  productInfo: 1800,    // 30 minutes
  branchInfo: 1800,     // 30 minutes
  userSession: 604800,  // 7 days
};

// Cache utility functions
export const cacheUtils = {
  // Set cache with TTL
  setCache: async (key: string, value: any, ttl?: number): Promise<void> => {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setEx(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.warn('Cache set failed:', error);
    }
  },

  // Get cache
  getCache: async <T>(key: string): Promise<T | null> => {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get failed:', error);
      return null;
    }
  },

  // Delete cache
  deleteCache: async (key: string): Promise<void> => {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn('Cache delete failed:', error);
    }
  },

  // Delete pattern-based cache
  deleteCachePattern: async (pattern: string): Promise<void> => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      logger.warn('Cache pattern delete failed:', error);
    }
  },

  // Increment counter
  incrementCounter: async (key: string, ttl?: number): Promise<number> => {
    try {
      const count = await redis.incr(key);
      if (ttl && count === 1) {
        await redis.expire(key, ttl);
      }
      return count;
    } catch (error) {
      logger.warn('Cache increment failed:', error);
      return 0;
    }
  }
};

// Error handling for database operations
export const handleDatabaseError = (error: any, operation: string) => {
  logger.error(`Database operation failed: ${operation}`, error);
  
  if (error.code === 'P2002') {
    throw new Error('Duplicate entry found');
  } else if (error.code === 'P2025') {
    throw new Error('Record not found');
  } else if (error.code === 'P2003') {
    throw new Error('Foreign key constraint failed');
  } else {
    throw new Error(`Database error: ${error.message}`);
  }
};