import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'sales_service',
    password: process.env.DB_PASSWORD || 'sales_password',
    database: process.env.DB_NAME || 'dried_fruits_db',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '3', 10),
    keyPrefix: 'sales:',
  },

  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: 'dried_fruits_events',
    queues: {
      salesRecording: 'sales.recording',
      inventoryUpdates: 'sales.inventory_updates',
      notifications: 'sales.notifications',
      analytics: 'sales.analytics',
    },
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'sales_jwt_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10), // Higher limit for POS systems
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // WebSocket configuration
  websocket: {
    port: parseInt(process.env.WS_PORT || '3006', 10),
    corsOrigin: process.env.WS_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },

  // Sales configuration
  sales: {
    defaultTaxRate: parseFloat(process.env.DEFAULT_TAX_RATE || '0.07'), // 7% VAT
    maxDiscountPercentage: parseFloat(process.env.MAX_DISCOUNT_PERCENTAGE || '50'), // 50% max discount
    autoVoidTimeoutMinutes: parseInt(process.env.AUTO_VOID_TIMEOUT || '30', 10),
    receiptTimeoutSeconds: parseInt(process.env.RECEIPT_TIMEOUT || '300', 10), // 5 minutes
    realTimeUpdateInterval: parseInt(process.env.REALTIME_UPDATE_INTERVAL || '5', 10), // 5 seconds
  },

  // External services
  services: {
    inventoryService: {
      url: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.INVENTORY_SERVICE_TIMEOUT || '5000', 10),
    },
    authService: {
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT || '5000', 10),
    },
    notificationService: {
      url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
      timeout: parseInt(process.env.NOTIFICATION_SERVICE_TIMEOUT || '5000', 10),
    },
  },

  // Payment processing
  payments: {
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    providers: {
      creditCard: {
        enabled: process.env.CREDIT_CARD_ENABLED === 'true',
        provider: process.env.CREDIT_CARD_PROVIDER || 'stripe',
        apiKey: process.env.CREDIT_CARD_API_KEY,
        secretKey: process.env.CREDIT_CARD_SECRET_KEY,
      },
      mobilePayment: {
        enabled: process.env.MOBILE_PAYMENT_ENABLED === 'true',
        providers: ['promptpay', 'truemoney', 'linepay'],
      },
    },
  },

  // Receipt configuration
  receipt: {
    companyName: process.env.COMPANY_NAME || 'Dried Fruits Premium Store',
    companyAddress: process.env.COMPANY_ADDRESS || '123 Main Street, Bangkok, Thailand',
    companyPhone: process.env.COMPANY_PHONE || '+66-2-123-4567',
    taxId: process.env.COMPANY_TAX_ID || '0123456789012',
    footerMessage: process.env.RECEIPT_FOOTER || 'Thank you for your purchase!',
    logoUrl: process.env.COMPANY_LOGO_URL,
  },

  // Mall integration
  mall: {
    enabled: process.env.MALL_INTEGRATION_ENABLED === 'true',
    apiUrl: process.env.MALL_API_URL,
    apiKey: process.env.MALL_API_KEY,
    syncInterval: parseInt(process.env.MALL_SYNC_INTERVAL || '60', 10), // 1 hour
    locations: process.env.MALL_LOCATIONS?.split(',') || [],
  },

  // Analytics configuration
  analytics: {
    enableRealTime: process.env.ANALYTICS_REALTIME === 'true',
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100', 10),
    aggregationInterval: parseInt(process.env.ANALYTICS_INTERVAL || '300', 10), // 5 minutes
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE,
  },
};