import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dried_fruits_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/dried_fruits_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3100'],
    credentials: true,
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  inventory: {
    lowStockThreshold: parseFloat(process.env.LOW_STOCK_THRESHOLD || '0.2'), // 20%
    criticalStockThreshold: parseFloat(process.env.CRITICAL_STOCK_THRESHOLD || '0.1'), // 10%
    autoReorderEnabled: process.env.AUTO_REORDER_ENABLED === 'true',
    stockCountSchedule: process.env.STOCK_COUNT_SCHEDULE || '0 2 * * 0', // Weekly at 2 AM Sunday
    alertCheckInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '300', 10), // 5 minutes
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20', 10),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};