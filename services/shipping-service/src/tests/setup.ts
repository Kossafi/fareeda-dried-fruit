// Jest setup file for shipping service tests

// Mock database connection
jest.mock('../database/connection', () => {
  return {
    __esModule: true,
    default: {
      getInstance: jest.fn(() => ({
        initialize: jest.fn(),
        query: jest.fn(),
        transaction: jest.fn(),
        setCache: jest.fn(),
        getCache: jest.fn(),
        deleteCache: jest.fn(),
        updateDriverLocation: jest.fn(),
        getDriverLocation: jest.fn(),
        publishEvent: jest.fn(),
        subscribeToEvents: jest.fn(),
        close: jest.fn(),
      })),
    },
  };
});

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3003';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test_jwt_secret';

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});