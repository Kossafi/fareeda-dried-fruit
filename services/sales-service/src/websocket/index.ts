import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import DatabaseConnection from '../database/connection';
import { config } from '../config';
import logger from '../utils/logger';

interface SocketUser {
  id: string;
  role: string;
  branchId?: string;
  permissions: string[];
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export class SalesWebSocketServer {
  private io: Server;
  private db: DatabaseConnection;
  private connectedUsers: Map<string, Set<string>> = new Map(); // branchId -> Set of socketIds

  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.websocket.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.db = DatabaseConnection.getInstance();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupRoomManagement();
    
    logger.info('Sales WebSocket server initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as SocketUser;
        socket.user = decoded;
        
        logger.info('WebSocket user authenticated', {
          userId: decoded.id,
          socketId: socket.id,
          branchId: decoded.branchId,
        });

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', {
          error: error.message,
          socketId: socket.id,
        });
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', {
        socketId: socket.id,
        userId: socket.user?.id,
        branchId: socket.user?.branchId,
      });

      // Join branch room if user has a branch
      if (socket.user?.branchId) {
        this.joinBranchRoom(socket, socket.user.branchId);
      }

      // Handle subscription to real-time sales updates
      socket.on('subscribe:sales', (data) => {
        this.handleSalesSubscription(socket, data);
      });

      // Handle subscription to dashboard updates
      socket.on('subscribe:dashboard', (data) => {
        this.handleDashboardSubscription(socket, data);
      });

      // Handle manual data refresh requests
      socket.on('refresh:dashboard', async (data) => {
        await this.handleDashboardRefresh(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', {
          socketId: socket.id,
          userId: socket.user?.id,
          error: error.message,
        });
      });
    });
  }

  private setupRoomManagement(): void {
    // Subscribe to sales events from RabbitMQ
    this.db.subscribeToEvents('sales.*.created', async (data, routingKey) => {
      await this.handleSaleCreated(data.data);
    });

    this.db.subscribeToEvents('sales.*.voided', async (data, routingKey) => {
      await this.handleSaleVoided(data.data);
    });

    this.db.subscribeToEvents('sales.*.completed', async (data, routingKey) => {
      await this.handleSaleCompleted(data.data);
    });

    // Periodic real-time data broadcast
    setInterval(async () => {
      await this.broadcastRealtimeUpdates();
    }, config.sales.realTimeUpdateInterval * 1000);
  }

  private joinBranchRoom(socket: any, branchId: string): void {
    const roomName = `branch:${branchId}`;
    socket.join(roomName);

    // Track connected users per branch
    if (!this.connectedUsers.has(branchId)) {
      this.connectedUsers.set(branchId, new Set());
    }
    this.connectedUsers.get(branchId)!.add(socket.id);

    logger.info('Socket joined branch room', {
      socketId: socket.id,
      branchId,
      roomName,
    });
  }

  private handleSalesSubscription(socket: any, data: { branchId?: string }): void {
    try {
      const branchId = data.branchId || socket.user?.branchId;
      
      if (!branchId) {
        socket.emit('subscription:error', { 
          message: 'Branch ID required for sales subscription' 
        });
        return;
      }

      // Check if user has access to this branch
      if (socket.user?.branchId && socket.user.branchId !== branchId && socket.user.role !== 'super_admin') {
        socket.emit('subscription:error', { 
          message: 'Access denied to this branch' 
        });
        return;
      }

      this.joinBranchRoom(socket, branchId);
      
      socket.emit('subscription:success', {
        type: 'sales',
        branchId,
        message: 'Subscribed to sales updates',
      });

    } catch (error) {
      logger.error('Sales subscription error', {
        error: error.message,
        socketId: socket.id,
        data,
      });
      
      socket.emit('subscription:error', { 
        message: 'Failed to subscribe to sales updates' 
      });
    }
  }

  private handleDashboardSubscription(socket: any, data: { branchId?: string }): void {
    try {
      const branchId = data.branchId || socket.user?.branchId;
      
      if (!branchId) {
        socket.emit('subscription:error', { 
          message: 'Branch ID required for dashboard subscription' 
        });
        return;
      }

      // Check access permissions
      if (socket.user?.branchId && socket.user.branchId !== branchId && socket.user.role !== 'super_admin') {
        socket.emit('subscription:error', { 
          message: 'Access denied to this branch dashboard' 
        });
        return;
      }

      this.joinBranchRoom(socket, branchId);
      
      // Send initial dashboard data
      this.sendDashboardData(socket, branchId);
      
      socket.emit('subscription:success', {
        type: 'dashboard',
        branchId,
        message: 'Subscribed to dashboard updates',
      });

    } catch (error) {
      logger.error('Dashboard subscription error', {
        error: error.message,
        socketId: socket.id,
        data,
      });
      
      socket.emit('subscription:error', { 
        message: 'Failed to subscribe to dashboard updates' 
      });
    }
  }

  private async handleDashboardRefresh(socket: any, data: { branchId?: string }): Promise<void> {
    try {
      const branchId = data.branchId || socket.user?.branchId;
      
      if (!branchId) {
        socket.emit('refresh:error', { 
          message: 'Branch ID required for dashboard refresh' 
        });
        return;
      }

      await this.sendDashboardData(socket, branchId);
      
    } catch (error) {
      logger.error('Dashboard refresh error', {
        error: error.message,
        socketId: socket.id,
        data,
      });
      
      socket.emit('refresh:error', { 
        message: 'Failed to refresh dashboard data' 
      });
    }
  }

  private async sendDashboardData(socket: any, branchId: string): Promise<void> {
    try {
      const dashboardData = await this.db.getCachedRealTimeSales(branchId);
      
      if (dashboardData) {
        socket.emit('dashboard:data', {
          branchId,
          data: dashboardData,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error sending dashboard data', {
        error: error.message,
        socketId: socket.id,
        branchId,
      });
    }
  }

  private handleDisconnection(socket: any): void {
    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId: socket.user?.id,
    });

    // Remove from connected users tracking
    if (socket.user?.branchId) {
      const branchUsers = this.connectedUsers.get(socket.user.branchId);
      if (branchUsers) {
        branchUsers.delete(socket.id);
        if (branchUsers.size === 0) {
          this.connectedUsers.delete(socket.user.branchId);
        }
      }
    }
  }

  private async handleSaleCreated(saleData: any): Promise<void> {
    try {
      const { branchId, saleId, totalAmount, itemCount, saleNumber } = saleData;
      
      // Broadcast to branch room
      this.io.to(`branch:${branchId}`).emit('sale:created', {
        saleId,
        saleNumber,
        totalAmount,
        itemCount,
        timestamp: new Date().toISOString(),
        type: 'sale_created',
      });

      // Update and broadcast real-time dashboard data
      await this.updateAndBroadcastDashboard(branchId);

    } catch (error) {
      logger.error('Error handling sale created event', {
        error: error.message,
        saleData,
      });
    }
  }

  private async handleSaleVoided(saleData: any): Promise<void> {
    try {
      const { saleId, branchId, reason } = saleData;
      
      // Broadcast to branch room
      this.io.to(`branch:${branchId}`).emit('sale:voided', {
        saleId,
        reason,
        timestamp: new Date().toISOString(),
        type: 'sale_voided',
      });

      // Update dashboard data
      await this.updateAndBroadcastDashboard(branchId);

    } catch (error) {
      logger.error('Error handling sale voided event', {
        error: error.message,
        saleData,
      });
    }
  }

  private async handleSaleCompleted(saleData: any): Promise<void> {
    try {
      const { saleId, branchId, totalAmount } = saleData;
      
      // Broadcast to branch room
      this.io.to(`branch:${branchId}`).emit('sale:completed', {
        saleId,
        totalAmount,
        timestamp: new Date().toISOString(),
        type: 'sale_completed',
      });

    } catch (error) {
      logger.error('Error handling sale completed event', {
        error: error.message,
        saleData,
      });
    }
  }

  private async updateAndBroadcastDashboard(branchId: string): Promise<void> {
    try {
      const dashboardData = await this.db.getCachedRealTimeSales(branchId);
      
      if (dashboardData) {
        this.io.to(`branch:${branchId}`).emit('dashboard:update', {
          branchId,
          data: dashboardData,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error updating and broadcasting dashboard', {
        error: error.message,
        branchId,
      });
    }
  }

  private async broadcastRealtimeUpdates(): Promise<void> {
    try {
      // Broadcast updates to all connected branches
      for (const branchId of this.connectedUsers.keys()) {
        await this.updateAndBroadcastDashboard(branchId);
      }
    } catch (error) {
      logger.error('Error in periodic realtime updates', {
        error: error.message,
      });
    }
  }

  // Public methods for external use
  public async broadcastSaleUpdate(branchId: string, saleData: any): Promise<void> {
    this.io.to(`branch:${branchId}`).emit('sale:update', {
      ...saleData,
      timestamp: new Date().toISOString(),
    });
  }

  public async broadcastSystemNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    this.io.emit('system:notification', {
      message,
      type,
      timestamp: new Date().toISOString(),
    });
  }

  public getConnectedUsersCount(): number {
    return this.io.sockets.sockets.size;
  }

  public getBranchConnections(): Map<string, number> {
    const branchConnections = new Map<string, number>();
    for (const [branchId, socketIds] of this.connectedUsers.entries()) {
      branchConnections.set(branchId, socketIds.size);
    }
    return branchConnections;
  }
}

export default SalesWebSocketServer;