import { config } from '../config';

// Override config for testing
config.nodeEnv = 'test';
config.database.database = 'dried_fruits_test_db';
config.database.url = 'postgresql://postgres:postgres123@localhost:5432/dried_fruits_test_db';
config.redis.url = 'redis://localhost:6379/2'; // Use different Redis database for tests
config.rabbitmq.url = 'amqp://admin:admin123@localhost:5672';

// Increase test timeout
jest.setTimeout(30000);