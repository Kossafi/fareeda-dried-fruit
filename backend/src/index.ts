import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Database and logging
import { connectDatabase, disconnectDatabase, checkDatabaseHealth, logger } from './config/database';

// Types
import { UserRole } from './types';

// Import routes
import authRoutes from './routes/auth';
import stockRoutes from './routes/stock';
import salesRoutes from './routes/sales';
import purchaseRoutes from './routes/purchase';
import receivingRoutes from './routes/receiving';
import analyticsRoutes from './routes/analytics';

// Middleware
import { authenticateToken, verifyToken } from './middleware/auth';

// Initialize Express app
const app: Application = express();
const server = createServer(app);

// Initialize Socket.IO with CORS
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Global rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'มีการเรียกใช้ API มากเกินไป กรุณาลองใหม่ในภายหลัง'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    const isHealthy = dbHealth.postgres && dbHealth.redis;
    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stock', authenticateToken, stockRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/purchase', authenticateToken, purchaseRoutes);
app.use('/api/receiving', authenticateToken, receivingRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ไม่พบ endpoint ที่ระบุ'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' 
      : err.message
  });
});

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('No token provided'));
  }

  const user = verifyToken(token);
  if (!user) {
    return next(new Error('Invalid token'));
  }

  // Attach user info to socket
  socket.data.user = user;
  next();
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const user = socket.data.user;
  logger.info(`Socket connected: ${user.username} (${user.role})`);

  // Join user to their branch room for real-time updates
  if (user.branchId) {
    socket.join(`branch:${user.branchId}`);
    logger.info(`User ${user.username} joined branch room: ${user.branchId}`);
  }

  // Join admin users to admin room
  if (user.role === UserRole.ADMIN) {
    socket.join('admin');
    logger.info(`Admin ${user.username} joined admin room`);
  }

  // Handle real-time stock level requests
  socket.on('subscribe-stock-updates', (productId: string) => {
    if (user.branchId) {
      socket.join(`stock:${user.branchId}:${productId}`);
      logger.debug(`User subscribed to stock updates: ${productId}`);
    }
  });

  socket.on('unsubscribe-stock-updates', (productId: string) => {
    if (user.branchId) {
      socket.leave(`stock:${user.branchId}:${productId}`);
      logger.debug(`User unsubscribed from stock updates: ${productId}`);
    }
  });

  // Handle real-time sales updates
  socket.on('subscribe-sales-feed', () => {
    if (user.branchId) {
      socket.join(`sales:${user.branchId}`);
      logger.debug(`User subscribed to sales feed for branch: ${user.branchId}`);
    }
    
    // Admin can subscribe to all branches
    if (user.role === UserRole.ADMIN) {
      socket.join('sales:all');
      logger.debug(`Admin subscribed to all sales feeds`);
    }
  });

  // Handle low stock alert subscriptions
  socket.on('subscribe-low-stock-alerts', () => {
    if (user.branchId) {
      socket.join(`alerts:${user.branchId}`);
      logger.debug(`User subscribed to low stock alerts for branch: ${user.branchId}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${user.username} (${reason})`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error(`Socket error for user ${user.username}:`, error);
  });
});

// Socket.IO error handler
io.engine.on('connection_error', (err) => {
  logger.error('Socket.IO connection error:', err);
});

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async (): Promise<void> => {
  try {
    // Connect to databases
    await connectDatabase();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Stock Management API server running on port ${PORT}`);
      logger.info(`📊 Real-time features enabled via Socket.IO`);
      logger.info(`🔒 JWT authentication enabled`);
      logger.info(`💾 PostgreSQL + Redis connected`);
      logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close Socket.IO connections
    io.close();
    
    // Close HTTP server
    server.close();
    
    // Disconnect from databases
    await disconnectDatabase();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;