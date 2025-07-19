import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

class RateLimiter {
  private redisClient;
  private windowMs: number;
  private maxRequests: number;

  constructor() {
    this.redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.windowMs = config.rateLimit.windowMs;
    this.maxRequests = config.rateLimit.max;

    this.redisClient.on('error', (error) => {
      logger.error('Rate limiter Redis client error:', error);
    });

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      await this.redisClient.connect();
      logger.info('Rate limiter Redis client connected');
    } catch (error) {
      logger.error('Failed to connect rate limiter Redis client:', error);
    }
  }

  async checkRateLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const window = Math.floor(now / this.windowMs);
    const windowKey = `${key}:${window}`;

    try {
      const current = await this.redisClient.get(windowKey);
      const totalHits = current ? parseInt(current) + 1 : 1;

      if (totalHits === 1) {
        // First request in this window, set expiration
        await this.redisClient.setEx(windowKey, Math.ceil(this.windowMs / 1000), '1');
      } else {
        // Increment the counter
        await this.redisClient.set(windowKey, totalHits.toString());
      }

      const remaining = Math.max(0, this.maxRequests - totalHits);
      const resetTime = (window + 1) * this.windowMs;

      return {
        allowed: totalHits <= this.maxRequests,
        remaining,
        resetTime,
        totalHits,
      };

    } catch (error) {
      logger.error('Rate limit check error:', error);
      // Allow request if Redis is down
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
        totalHits: 1,
      };
    }
  }

  async close(): Promise<void> {
    try {
      await this.redisClient.disconnect();
    } catch (error) {
      logger.error('Error closing rate limiter Redis client:', error);
    }
  }
}

const rateLimiter = new RateLimiter();

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Create identifier based on user ID (if authenticated) or IP address
    const identifier = req.user?.id || req.ip || 'anonymous';
    
    const result = await rateLimiter.checkRateLimit(identifier);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.rateLimit.max.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    });

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        identifier,
        totalHits: result.totalHits,
        maxRequests: config.rateLimit.max,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(429).json({
        success: false,
        message: config.rateLimit.message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }

    next();

  } catch (error) {
    logger.error('Rate limit middleware error:', error);
    // Continue without rate limiting if there's an error
    next();
  }
};

// Specialized rate limiter for high-frequency operations (like location updates)
export const highFrequencyRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const identifier = req.user?.id || req.ip || 'anonymous';
    
    // More restrictive limits for high-frequency endpoints
    const result = await rateLimiter.checkRateLimit(`hf:${identifier}`);

    // Use custom limits for high-frequency operations
    const maxHfRequests = Math.floor(config.rateLimit.max / 2); // 50% of normal limit
    
    res.set({
      'X-RateLimit-Limit': maxHfRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxHfRequests - result.totalHits).toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    });

    if (result.totalHits > maxHfRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many high-frequency requests',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }

    next();

  } catch (error) {
    logger.error('High-frequency rate limit middleware error:', error);
    next();
  }
};

export default rateLimiter;