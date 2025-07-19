import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { config } from './config';
import logger from './utils/logger';
import DatabaseConnection from './database/connection';
import routes from './routes';

const app = express();
const server = createServer(app);

// WebSocket setup for real-time tracking
const io = new Server(server, {
  cors: {
    origin: config.websocket.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

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

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Shipping and Delivery Order Management System API',
    service: 'shipping-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      status: '/api/status',
      shipping: '/api/shipping',
      orders: '/api/orders',
      drivers: '/api/drivers',
      delivery: '/api/delivery',
    },
  });
});

// WebSocket handling for real-time tracking
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', { socketId: socket.id });

  // Join delivery tracking room
  socket.on('track_delivery', (deliveryOrderId: string) => {
    socket.join(`delivery_${deliveryOrderId}`);
    logger.info('Client joined delivery tracking', { 
      socketId: socket.id, 
      deliveryOrderId 
    });
  });

  // Join driver tracking room
  socket.on('track_driver', (driverId: string) => {
    socket.join(`driver_${driverId}`);
    logger.info('Client joined driver tracking', { 
      socketId: socket.id, 
      driverId 
    });
  });

  // Handle location updates from drivers
  socket.on('driver_location_update', async (data: {
    driverId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }) => {
    try {
      const db = DatabaseConnection.getInstance();
      await db.updateDriverLocation(data.driverId, data.latitude, data.longitude);
      
      // Broadcast to all clients tracking this driver
      socket.to(`driver_${data.driverId}`).emit('driver_location_updated', data);
      
      logger.info('Driver location updated', {
        driverId: data.driverId,
        latitude: data.latitude,
        longitude: data.longitude,
      });
    } catch (error) {
      logger.error('Error updating driver location:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Handle delivery status updates
  socket.on('delivery_status_update', (data: {
    deliveryOrderId: string;
    status: string;
    location?: string;
    timestamp: string;
  }) => {
    // Broadcast to all clients tracking this delivery
    socket.to(`delivery_${data.deliveryOrderId}`).emit('delivery_status_updated', data);
    
    logger.info('Delivery status update broadcasted', {
      deliveryOrderId: data.deliveryOrderId,
      status: data.status,
    });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket', { socketId: socket.id });
  });
});

// Global WebSocket emitter function
global.broadcastDeliveryUpdate = (deliveryOrderId: string, data: any) => {
  io.to(`delivery_${deliveryOrderId}`).emit('delivery_updated', data);
};

global.broadcastDriverUpdate = (driverId: string, data: any) => {
  io.to(`driver_${driverId}`).emit('driver_updated', data);
};

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
    
    // Subscribe to relevant events
    await db.subscribeToEvents('inventory.*', async (data, routingKey) => {
      logger.info('Received inventory event', { routingKey, data });
      // Handle inventory events (stock updates, reservations, etc.)
    });

    await db.subscribeToEvents('auth.users.*', async (data, routingKey) => {
      logger.info('Received user event', { routingKey, data });
      // Handle user events (driver updates, etc.)
    });

    // Start server
    server.listen(config.port, () => {
      logger.info('Shipping service started', {
        port: config.port,
        environment: config.nodeEnv,
        processId: process.pid,
      });

      console.log(`
🚀 Shipping and Delivery Order Management System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment: ${config.nodeEnv}
HTTP Server: http://localhost:${config.port}
WebSocket: ws://localhost:${config.port}

API Endpoints:
• Health Check: GET /api/health
• Service Status: GET /api/status
• Shipping API: /api/shipping
• Delivery Orders: /api/orders
• Drivers API: /api/drivers
• Delivery Confirmation: /api/delivery

Features:
✅ Delivery order creation and management
✅ Real-time order tracking with WebSocket
✅ Driver assignment and route optimization
✅ Inventory integration and stock reservation
✅ Multi-unit support (gram, keed, kg, pack, piece)
✅ Delivery confirmation and verification
✅ Automatic stock transfer upon confirmation
✅ Discrepancy reporting and handling
✅ Quantity verification with barcode scanning
✅ Performance analytics and reporting
✅ GPS location tracking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
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
    
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    io.close(() => {
      logger.info('WebSocket server closed');
    });
    
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
    
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    io.close(() => {
      logger.info('WebSocket server closed');
    });
    
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

// Export for testing
export { app, io };