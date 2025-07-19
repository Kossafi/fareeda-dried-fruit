import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'shipping_service',
    password: process.env.DB_PASSWORD || 'shipping_password',
    database: process.env.DB_NAME || 'dried_fruits_db',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '2', 10),
    keyPrefix: 'shipping:',
  },

  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: 'dried_fruits_events',
    queues: {
      deliveryTracking: 'shipping.delivery_tracking',
      notifications: 'shipping.notifications',
      inventoryUpdates: 'shipping.inventory_updates',
    },
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'shipping_jwt_secret_key',
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
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // WebSocket configuration
  websocket: {
    port: parseInt(process.env.WS_PORT || '3004', 10),
    corsOrigin: process.env.WS_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },

  // Delivery configuration
  delivery: {
    defaultEstimatedTimeMinutes: parseInt(process.env.DEFAULT_DELIVERY_TIME || '120', 10),
    maxDeliveryDays: parseInt(process.env.MAX_DELIVERY_DAYS || '7', 10),
    locationUpdateIntervalMinutes: parseInt(process.env.LOCATION_UPDATE_INTERVAL || '5', 10),
    autoConfirmTimeoutHours: parseInt(process.env.AUTO_CONFIRM_TIMEOUT || '24', 10),
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
      url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
      timeout: parseInt(process.env.NOTIFICATION_SERVICE_TIMEOUT || '5000', 10),
    },
  },

  // GPS and location services
  gps: {
    enabled: process.env.GPS_ENABLED === 'true',
    provider: process.env.GPS_PROVIDER || 'internal',
    apiKey: process.env.GPS_API_KEY,
    updateIntervalSeconds: parseInt(process.env.GPS_UPDATE_INTERVAL || '30', 10),
  },

  // Route optimization
  routing: {
    enabled: process.env.ROUTING_ENABLED === 'true',
    provider: process.env.ROUTING_PROVIDER || 'internal',
    apiKey: process.env.ROUTING_API_KEY,
    maxStopsPerRoute: parseInt(process.env.MAX_STOPS_PER_ROUTE || '10', 10),
    maxDistanceKm: parseInt(process.env.MAX_ROUTE_DISTANCE || '200', 10),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE,
  },
};