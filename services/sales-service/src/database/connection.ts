import { Pool, PoolClient, PoolConfig } from 'pg';
import { Client } from 'redis';
import amqp, { Connection, Channel } from 'amqplib';
import { config } from '../config';
import logger from '../utils/logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pgPool: Pool;
  private redisClient: Client;
  private rabbitConnection?: Connection;
  private rabbitChannel?: Channel;

  private constructor() {
    // PostgreSQL configuration
    const pgConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    this.pgPool = new Pool(pgConfig);

    // Redis configuration
    this.redisClient = new Client({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    // Setup error handlers
    this.setupErrorHandlers();
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Test PostgreSQL connection
      const client = await this.pgPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection established');

      // Connect to Redis
      await this.redisClient.connect();
      logger.info('Redis connection established');

      // Connect to RabbitMQ
      await this.connectRabbitMQ();
      logger.info('RabbitMQ connection established');

    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async connectRabbitMQ(): Promise<void> {
    try {
      this.rabbitConnection = await amqp.connect(config.rabbitmq.url);
      this.rabbitChannel = await this.rabbitConnection.createChannel();

      // Declare exchange
      await this.rabbitChannel.assertExchange(
        config.rabbitmq.exchange,
        'topic',
        { durable: true }
      );

      // Declare queues
      for (const queueName of Object.values(config.rabbitmq.queues)) {
        await this.rabbitChannel.assertQueue(queueName, { durable: true });
      }

      // Setup RabbitMQ error handlers
      this.rabbitConnection.on('error', (error) => {
        logger.error('RabbitMQ connection error:', error);
      });

      this.rabbitConnection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
      });

    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      throw error;
    }
  }

  private setupErrorHandlers(): void {
    this.pgPool.on('error', (error) => {
      logger.error('PostgreSQL pool error:', error);
    });

    this.redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });
  }

  // PostgreSQL methods
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Redis methods
  async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redisClient.setEx(key, ttlSeconds, serializedValue);
    } else {
      await this.redisClient.set(key, serializedValue);
    }
  }

  async getCache(key: string): Promise<any | null> {
    const value = await this.redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async deleteCache(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async setCachePattern(pattern: string, ttlSeconds?: number): Promise<void> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      if (ttlSeconds) {
        const pipeline = this.redisClient.multi();
        keys.forEach(key => pipeline.expire(key, ttlSeconds));
        await pipeline.exec();
      }
    }
  }

  // RabbitMQ methods
  async publishEvent(routingKey: string, eventType: string, data: any): Promise<void> {
    if (!this.rabbitChannel) {
      throw new Error('RabbitMQ channel not available');
    }

    const message = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
      service: 'sales-service',
    };

    const fullRoutingKey = `sales.${routingKey}.${eventType}`;

    await this.rabbitChannel.publish(
      config.rabbitmq.exchange,
      fullRoutingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    logger.debug('Event published', { routingKey: fullRoutingKey, eventType });
  }

  async subscribeToEvents(
    pattern: string,
    callback: (data: any, routingKey: string) => Promise<void>
  ): Promise<void> {
    if (!this.rabbitChannel) {
      throw new Error('RabbitMQ channel not available');
    }

    const queueName = `sales_service_${pattern.replace(/[.*]/g, '_')}`;
    const queue = await this.rabbitChannel.assertQueue(queueName, { durable: true });

    await this.rabbitChannel.bindQueue(
      queue.queue,
      config.rabbitmq.exchange,
      pattern
    );

    await this.rabbitChannel.consume(queue.queue, async (message) => {
      if (message) {
        try {
          const content = JSON.parse(message.content.toString());
          const routingKey = message.fields.routingKey;
          
          await callback(content, routingKey);
          this.rabbitChannel?.ack(message);
        } catch (error) {
          logger.error('Error processing message:', error);
          this.rabbitChannel?.nack(message, false, false);
        }
      }
    });

    logger.info(`Subscribed to events with pattern: ${pattern}`);
  }

  // Sales-specific cache methods
  async cacheDailySales(branchId: string, date: string, data: any): Promise<void> {
    const cacheKey = `daily_sales:${branchId}:${date}`;
    await this.setCache(cacheKey, data, 86400); // 24 hours TTL
  }

  async getCachedDailySales(branchId: string, date: string): Promise<any | null> {
    const cacheKey = `daily_sales:${branchId}:${date}`;
    return await this.getCache(cacheKey);
  }

  async cacheRealTimeSales(branchId: string, data: any): Promise<void> {
    const cacheKey = `realtime_sales:${branchId}`;
    await this.setCache(cacheKey, data, config.sales.realTimeUpdateInterval);
  }

  async getCachedRealTimeSales(branchId: string): Promise<any | null> {
    const cacheKey = `realtime_sales:${branchId}`;
    return await this.getCache(cacheKey);
  }

  async cacheProductPrice(productId: string, branchId: string, price: number): Promise<void> {
    const cacheKey = `product_price:${productId}:${branchId}`;
    await this.setCache(cacheKey, { price, updatedAt: new Date() }, 3600); // 1 hour TTL
  }

  async getCachedProductPrice(productId: string, branchId: string): Promise<{ price: number; updatedAt: Date } | null> {
    const cacheKey = `product_price:${productId}:${branchId}`;
    return await this.getCache(cacheKey);
  }

  async invalidateDailySalesCache(branchId: string, date: string): Promise<void> {
    const cacheKey = `daily_sales:${branchId}:${date}`;
    await this.deleteCache(cacheKey);
  }

  async updateRealTimeSalesCache(branchId: string, saleData: any): Promise<void> {
    // Get current real-time data
    const currentData = await this.getCachedRealTimeSales(branchId) || {
      todaySales: 0,
      todayRevenue: 0,
      todayTransactions: 0,
      recentSales: [],
    };

    // Update metrics
    currentData.todaySales += 1;
    currentData.todayRevenue += saleData.totalAmount;
    currentData.todayTransactions += 1;

    // Add to recent sales (keep only last 10)
    currentData.recentSales.unshift({
      saleNumber: saleData.saleNumber,
      amount: saleData.totalAmount,
      itemCount: saleData.itemCount,
      timestamp: new Date(),
      customerName: saleData.customerName,
    });

    if (currentData.recentSales.length > 10) {
      currentData.recentSales = currentData.recentSales.slice(0, 10);
    }

    // Update average transaction value
    if (currentData.todayTransactions > 0) {
      currentData.averageTransactionValue = currentData.todayRevenue / currentData.todayTransactions;
    }

    currentData.lastUpdated = new Date();
    currentData.isLive = true;

    await this.cacheRealTimeSales(branchId, currentData);
  }

  // Cleanup and close connections
  async close(): Promise<void> {
    try {
      await this.pgPool.end();
      await this.redisClient.disconnect();
      
      if (this.rabbitChannel) {
        await this.rabbitChannel.close();
      }
      
      if (this.rabbitConnection) {
        await this.rabbitConnection.close();
      }
      
      logger.info('All database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
      throw error;
    }
  }
}

export default DatabaseConnection;