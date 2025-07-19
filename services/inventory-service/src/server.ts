import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import logger from './utils/logger';
import DatabaseConnection from './database/connection';
import inventoryRoutes from './routes/inventory';
import repackRoutes from './routes/repack';
import barcodeRoutes from './routes/barcode';
import { AlertChecker } from './jobs/alertChecker';
import { RepackProcessor } from './jobs/repackProcessor';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  req.headers['x-request-id'] = requestId;
  
  logger.info(`${req.method} ${req.url}`, {
    requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'inventory-service',
    version: '1.0.0',
  });
});

// API routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/repack', repackRoutes);
app.use('/api/barcode', barcodeRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    requestId: req.headers['x-request-id'],
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Database connection and server startup
async function startServer(): Promise<void> {
  try {
    // Initialize database connections
    const db = DatabaseConnection.getInstance();
    await db.initialize();
    
    // Start alert checker job
    const alertChecker = new AlertChecker();
    alertChecker.start();

    // Start repack processor job
    const repackProcessor = new RepackProcessor();
    repackProcessor.start();

    // Start server
    app.listen(config.port, () => {
      logger.info(`Inventory service listening on port ${config.port}`, {
        environment: config.nodeEnv,
        cors: config.cors.origin,
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    const db = DatabaseConnection.getInstance();
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    const db = DatabaseConnection.getInstance();
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();