import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  services: {
    auth: {
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      timeout: 5000,
    },
    inventory: {
      url: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002',
      timeout: 10000,
    },
    sales: {
      url: process.env.SALES_SERVICE_URL || 'http://localhost:3003',
      timeout: 10000,
    },
    shipping: {
      url: process.env.SHIPPING_SERVICE_URL || 'http://localhost:3004',
      timeout: 10000,
    },
    notification: {
      url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
      timeout: 5000,
    },
    reporting: {
      url: process.env.REPORTING_SERVICE_URL || 'http://localhost:3006',
      timeout: 30000,
    },
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3100'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};