import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pgPool: Pool;
  private redisClient: RedisClientType;

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

    this.redisClient.on('ready', () => {
      logger.info('Redis client ready');
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
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pgPool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms:`, { query: text, duration });
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

  public async close(): Promise<void> {
    await this.pgPool.end();
    await this.redisClient.quit();
    logger.info('Database connections closed');
  }
}

export default DatabaseConnection;