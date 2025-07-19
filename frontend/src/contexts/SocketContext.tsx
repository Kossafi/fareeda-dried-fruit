import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SocketEvents, StockLevel, SaleRecord, PurchaseOrderStatus } from '@types/index';
import toast from 'react-hot-toast';

// Socket Context Type
interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  
  // Stock level subscriptions
  subscribeToStockUpdates: (productId: string) => void;
  unsubscribeFromStockUpdates: (productId: string) => void;
  
  // Sales feed subscriptions
  subscribeToSalesFeed: () => void;
  unsubscribeFromSalesFeed: () => void;
  
  // Low stock alert subscriptions
  subscribeToLowStockAlerts: () => void;
  unsubscribeFromLowStockAlerts: () => void;
  
  // Event listeners
  onStockLevelUpdate: (callback: (data: { productId: string; branchId: string; quantity: number }) => void) => () => void;
  onLowStockAlert: (callback: (data: { productId: string; branchId: string; currentQuantity: number; threshold: number }) => void) => () => void;
  onNewSale: (callback: (data: SaleRecord) => void) => () => void;
  onSalesSummaryUpdate: (callback: (data: { branchId: string; totalSales: number; totalQuantity: number }) => void) => () => void;
  onPurchaseOrderUpdate: (callback: (data: { orderId: string; status: PurchaseOrderStatus }) => void) => () => void;
  onStockReceivingComplete: (callback: (data: { receivingId: string; branchId: string }) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Socket Provider Props
interface SocketProviderProps {
  children: ReactNode;
}

// Socket Provider Component
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { token, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);

  // Socket connection effect
  useEffect(() => {
    if (isAuthenticated && token && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, token, user]);

  const connectSocket = () => {
    if (socket?.connected) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
      reconnectAttempts.current = 0;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
      
      // Auto-reconnect if disconnected unexpectedly
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        scheduleReconnect(newSocket);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
      
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        toast.error('ไม่สามารถเชื่อมต่อแบบเรียลไทม์ได้');
      }
    });

    // Set up default event listeners for notifications
    setupDefaultEventListeners(newSocket);

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const scheduleReconnect = (socketInstance: Socket) => {
    if (reconnectTimeoutRef.current) return;
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (reconnectAttempts.current < maxReconnectAttempts) {
        console.log('Attempting to reconnect socket...');
        socketInstance.connect();
      }
      reconnectTimeoutRef.current = null;
    }, 2000);
  };

  const setupDefaultEventListeners = (socketInstance: Socket) => {
    // Low stock alerts
    socketInstance.on('low-stock-alert', (data) => {
      toast.error(`สินค้าใกล้หมด: ${data.productId} เหลือ ${data.currentQuantity} ชิ้น`, {
        duration: 6000,
        icon: '⚠️',
      });
    });

    // New sales notifications (for managers/admins)
    socketInstance.on('new-sale', (data: SaleRecord) => {
      if (user?.role === 'MANAGER' || user?.role === 'ADMIN') {
        toast.success(`การขายใหม่: ${data.totalQuantity} ชิ้น`, {
          duration: 3000,
          icon: '🛒',
        });
      }
    });

    // Purchase order updates
    socketInstance.on('purchase-order-update', (data) => {
      const statusText = {
        'APPROVED': 'อนุมัติแล้ว',
        'DELIVERED': 'ส่งมอบแล้ว',
        'CANCELLED': 'ยกเลิกแล้ว'
      }[data.status] || data.status;
      
      toast.info(`ใบสั่งซื้อ: ${statusText}`, {
        duration: 4000,
        icon: '📦',
      });
    });

    // Stock receiving complete
    socketInstance.on('stock-receiving-complete', (data) => {
      toast.success('รับสินค้าเข้าคลังเรียบร้อยแล้ว', {
        duration: 4000,
        icon: '✅',
      });
    });
  };

  // Subscription methods
  const subscribeToStockUpdates = (productId: string) => {
    if (socket?.connected) {
      socket.emit('subscribe-stock-updates', productId);
    }
  };

  const unsubscribeFromStockUpdates = (productId: string) => {
    if (socket?.connected) {
      socket.emit('unsubscribe-stock-updates', productId);
    }
  };

  const subscribeToSalesFeed = () => {
    if (socket?.connected) {
      socket.emit('subscribe-sales-feed');
    }
  };

  const unsubscribeFromSalesFeed = () => {
    if (socket?.connected) {
      socket.off('new-sale');
      socket.off('sales-summary-update');
    }
  };

  const subscribeToLowStockAlerts = () => {
    if (socket?.connected) {
      socket.emit('subscribe-low-stock-alerts');
    }
  };

  const unsubscribeFromLowStockAlerts = () => {
    if (socket?.connected) {
      socket.off('low-stock-alert');
    }
  };

  // Event listener helpers
  const onStockLevelUpdate = (callback: (data: { productId: string; branchId: string; quantity: number }) => void) => {
    if (socket) {
      socket.on('stock-level-update', callback);
      return () => socket.off('stock-level-update', callback);
    }
    return () => {};
  };

  const onLowStockAlert = (callback: (data: { productId: string; branchId: string; currentQuantity: number; threshold: number }) => void) => {
    if (socket) {
      socket.on('low-stock-alert', callback);
      return () => socket.off('low-stock-alert', callback);
    }
    return () => {};
  };

  const onNewSale = (callback: (data: SaleRecord) => void) => {
    if (socket) {
      socket.on('new-sale', callback);
      return () => socket.off('new-sale', callback);
    }
    return () => {};
  };

  const onSalesSummaryUpdate = (callback: (data: { branchId: string; totalSales: number; totalQuantity: number }) => void) => {
    if (socket) {
      socket.on('sales-summary-update', callback);
      return () => socket.off('sales-summary-update', callback);
    }
    return () => {};
  };

  const onPurchaseOrderUpdate = (callback: (data: { orderId: string; status: PurchaseOrderStatus }) => void) => {
    if (socket) {
      socket.on('purchase-order-update', callback);
      return () => socket.off('purchase-order-update', callback);
    }
    return () => {};
  };

  const onStockReceivingComplete = (callback: (data: { receivingId: string; branchId: string }) => void) => {
    if (socket) {
      socket.on('stock-receiving-complete', callback);
      return () => socket.off('stock-receiving-complete', callback);
    }
    return () => {};
  };

  const contextValue: SocketContextType = {
    socket,
    connected,
    subscribeToStockUpdates,
    unsubscribeFromStockUpdates,
    subscribeToSalesFeed,
    unsubscribeFromSalesFeed,
    subscribeToLowStockAlerts,
    unsubscribeFromLowStockAlerts,
    onStockLevelUpdate,
    onLowStockAlert,
    onNewSale,
    onSalesSummaryUpdate,
    onPurchaseOrderUpdate,
    onStockReceivingComplete,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use socket context
export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;