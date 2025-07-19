import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import amqp, { Connection, Channel } from 'amqplib';
import { config } from '../config';
import logger from '../utils/logger';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pgPool: Pool;
  private redisClient: RedisClientType;
  private rabbitConnection: Connection | null = null;
  private rabbitChannel: Channel | null = null;

  private constructor() {
    this.pgPool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.redisClient = createClient({
      url: config.redis.url,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupEventHandlers(): void {
    this.pgPool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', err);
    });

    this.redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  public async initialize(): Promise<void> {
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
      await this.connectToRabbitMQ();
      logger.info('RabbitMQ connection established');

    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      this.rabbitConnection = await amqp.connect(config.rabbitmq.url);
      this.rabbitChannel = await this.rabbitConnection.createChannel();

      // Setup exchanges and queues
      await this.setupRabbitMQExchanges();

      this.rabbitConnection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
      });

      this.rabbitConnection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect...');
        setTimeout(() => this.connectToRabbitMQ(), 5000);
      });

    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      setTimeout(() => this.connectToRabbitMQ(), 5000);
    }
  }

  private async setupRabbitMQExchanges(): Promise<void> {
    if (!this.rabbitChannel) return;

    // Inventory events exchange
    await this.rabbitChannel.assertExchange('inventory.events', 'topic', { durable: true });
    
    // Stock alerts exchange
    await this.rabbitChannel.assertExchange('stock.alerts', 'fanout', { durable: true });
    
    // Repack orders exchange
    await this.rabbitChannel.assertExchange('repack.orders', 'direct', { durable: true });

    // Declare queues
    await this.rabbitChannel.assertQueue('stock.movements', { durable: true });
    await this.rabbitChannel.assertQueue('low.stock.alerts', { durable: true });
    await this.rabbitChannel.assertQueue('repack.notifications', { durable: true });

    // Bind queues to exchanges
    await this.rabbitChannel.bindQueue('stock.movements', 'inventory.events', 'stock.movement.*');
    await this.rabbitChannel.bindQueue('low.stock.alerts', 'stock.alerts', '');
    await this.rabbitChannel.bindQueue('repack.notifications', 'repack.orders', 'completed');

    logger.info('RabbitMQ exchanges and queues setup completed');
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pgPool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms`, { query: text, duration });
      return result;
    } catch (error) {
      logger.error('Query execution failed:', { query: text, error });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return this.pgPool.connect();
  }

  public getRedisClient(): RedisClientType {
    return this.redisClient;
  }

  public getRabbitChannel(): Channel | null {
    return this.rabbitChannel;
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
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

  public async publishEvent(exchange: string, routingKey: string, data: any): Promise<void> {
    if (!this.rabbitChannel) {
      logger.warn('RabbitMQ channel not available, event not published');
      return;
    }

    try {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        service: 'inventory-service',
      });

      await this.rabbitChannel.publish(
        exchange,
        routingKey,
        Buffer.from(message),
        { persistent: true }
      );

      logger.debug('Event published', { exchange, routingKey, data });
    } catch (error) {
      logger.error('Failed to publish event:', { exchange, routingKey, error });
    }
  }

  public async close(): Promise<void> {
    await this.pgPool.end();
    await this.redisClient.quit();
    
    if (this.rabbitChannel) {
      await this.rabbitChannel.close();
    }
    
    if (this.rabbitConnection) {
      await this.rabbitConnection.close();
    }
    
    logger.info('All database connections closed');
  }
}

export default DatabaseConnection;