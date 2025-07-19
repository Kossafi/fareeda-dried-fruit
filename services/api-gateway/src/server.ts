import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.API_GATEWAY_PORT || 8001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for the web interface)
app.use(express.static(path.join(__dirname, '../../../web')));

// Service URLs
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002',
  sales: process.env.SALES_SERVICE_URL || 'http://localhost:3003',
  shipping: process.env.SHIPPING_SERVICE_URL || 'http://localhost:3004'
};

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: services
  });
});

// API Routes with Proxy
app.use('/api/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' }
}));

app.use('/api/inventory', createProxyMiddleware({
  target: services.inventory,
  changeOrigin: true,
  pathRewrite: { '^/api/inventory': '' }
}));

app.use('/api/sales', createProxyMiddleware({
  target: services.sales,
  changeOrigin: true,
  pathRewrite: { '^/api/sales': '' }
}));

app.use('/api/shipping', createProxyMiddleware({
  target: services.shipping,
  changeOrigin: true,
  pathRewrite: { '^/api/shipping': '' }
}));

// Web Interface Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/dashboard.html'));
});

app.get('/inventory', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/inventory.html'));
});

app.get('/sales', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/sales.html'));
});

app.get('/delivery', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/delivery.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/reports.html'));
});

app.get('/barcode', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/barcode.html'));
});

app.get('/purchase', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../web/purchase.html'));
});

// WebSocket for Real-time Updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global WebSocket instance for other services to use
export { io };

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

server.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`📦 Inventory: http://localhost:${PORT}/inventory`);
  console.log(`💰 Sales: http://localhost:${PORT}/sales`);
  console.log(`🚚 Delivery: http://localhost:${PORT}/delivery`);
  console.log(`📈 Reports: http://localhost:${PORT}/reports`);
  console.log(`📱 Barcode: http://localhost:${PORT}/barcode`);
  console.log(`🛒 Purchase: http://localhost:${PORT}/purchase`);
});