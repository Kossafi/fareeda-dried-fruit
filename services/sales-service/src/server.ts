import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import DatabaseConnection from './database/connection';
import SalesWebSocketServer from './websocket';
import routes from './routes';
import { config } from './config';
import logger from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors(config.cors));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  next();
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sales Recording and Tracking System API',
    service: 'sales-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      status: '/api/status',
      sales: '/api/sales',
      customers: '/api/customers',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(error.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' 
      ? 'Internal server error' 
      : error.message,
    timestamp: new Date().toISOString(),
    ...(config.nodeEnv === 'development' && { stack: error.stack }),
  });
});

class SalesServiceServer {
  private db: DatabaseConnection;
  private websocketServer: SalesWebSocketServer;

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.websocketServer = new SalesWebSocketServer(httpServer);
  }

  async start(): Promise<void> {
    try {
      // Initialize database connections
      await this.db.initialize();
      logger.info('Database connections established');

      // Start HTTP server
      httpServer.listen(config.port, () => {
        logger.info('Sales service started', {
          port: config.port,
          environment: config.nodeEnv,
          websocketPort: config.websocket.port,
          processId: process.pid,
        });

        console.log(`
🚀 Sales Recording and Tracking Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment: ${config.nodeEnv}
HTTP Server: http://localhost:${config.port}
WebSocket: ws://localhost:${config.port}

API Endpoints:
• Health Check: GET /api/health
• Service Status: GET /api/status
• Sales API: /api/sales
• Customers API: /api/customers

Features:
✅ Real-time sales recording
✅ Multi-unit inventory support (gram, keed, kg, pack, piece)
✅ Automatic stock deduction
✅ Instant central sync
✅ Mall branch support
✅ Customer tracking
✅ Payment processing
✅ Real-time WebSocket updates
✅ Analytics & reporting
✅ Barcode scanning integration

Thai Language Support:
🇹🇭 บันทึกการขายในหน่วยต่างๆ
🇹🇭 หักสต๊อคอัตโนมัติแบบเรียลไทม์
🇹🇭 ส่งข้อมูลการขายกลับไปยังส่วนกลางทันที
🇹🇭 รองรับการขายในสาขาห้างสรรพสินค้า
🇹🇭 ติดตามประวัติการขายและลูกค้า
🇹🇭 การคำนวณราคาและส่วนลดอัตโนมัติ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start sales service', { error: error.message });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Close HTTP server
      httpServer.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close database connections
          await this.db.close();
          logger.info('Database connections closed');

          logger.info('Sales service shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      process.exit(1);
    });
  }

  // Public methods for external access
  public getWebSocketServer(): SalesWebSocketServer {
    return this.websocketServer;
  }

  public getDatabase(): DatabaseConnection {
    return this.db;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new SalesServiceServer();
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

export default SalesServiceServer;
export { app, httpServer };