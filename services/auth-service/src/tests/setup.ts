import { config } from '../config';

// Override config for testing
config.nodeEnv = 'test';
config.database.database = 'dried_fruits_test_db';
config.database.url = 'postgresql://postgres:postgres123@localhost:5432/dried_fruits_test_db';
config.redis.url = 'redis://localhost:6379/1'; // Use different Redis database for tests
config.jwt.secret = 'test-jwt-secret';
config.bcrypt.saltRounds = 4; // Faster for tests

// Increase test timeout
jest.setTimeout(30000);