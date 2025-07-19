import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, logger, cacheUtils, cacheKeys } from '../config/database';
import { 
  PurchaseOrderRequest, 
  PurchaseOrderInfo, 
  ApiResponse, 
  PaginatedResponse,
  OrderStatus
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

// Generate purchase order number
const generateOrderNumber = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `PO${dateStr}${timeStr}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

/**
 * Create purchase order (เน้นการสั่งซื้อตามจำนวน)
 */
export const createPurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { items, notes }: PurchaseOrderRequest = req.body;
    const requestedBy = req.user!.id;
    const branchId = req.user!.branchId!;

    // Validate items
    if (!items || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'ต้องมีสินค้าอย่างน้อย 1 รายการ'
      } as ApiResponse);
      return;
    }

    // Validate products exist
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      res.status(400).json({
        success: false,
        error: 'พบสินค้าที่ไม่ถูกต้องหรือไม่พร้อมใช้งาน'
      } as ApiResponse);
      return;
    }

    // Create purchase order
    const orderNumber = generateOrderNumber();
    const totalQuantity = items.reduce((sum, item) => sum + item.requestedQuantity, 0);

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        branchId,
        requestedBy,
        totalItems: items.length,
        totalQuantity,
        notes,
        status: OrderStatus.PENDING,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            requestedQuantity: item.requestedQuantity,
            unit: item.unit,
            notes: item.notes
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        requestedUser: true
      }
    });

    // Format response
    const orderInfo: PurchaseOrderInfo = {
      id: purchaseOrder.id,
      orderNumber: purchaseOrder.orderNumber,
      branchName: purchaseOrder.branch.name,
      requestedBy: purchaseOrder.requestedUser.fullName,
      status: purchaseOrder.status,
      totalItems: purchaseOrder.totalItems,
      totalQuantity: purchaseOrder.totalQuantity,
      items: purchaseOrder.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: purchaseOrder.notes || undefined,
      requestedAt: purchaseOrder.requestedAt,
      processedAt: purchaseOrder.processedAt || undefined,
      deliveredAt: purchaseOrder.deliveredAt || undefined
    };

    // Emit real-time notification to warehouse staff
    io.to('warehouse').emit('new-purchase-order', {
      order: orderInfo,
      timestamp: new Date()
    });

    logger.info(`Purchase order created: ${orderNumber} by ${req.user!.username}`);

    res.status(201).json({
      success: true,
      data: orderInfo,
      message: 'สร้างใบสั่งซื้อสำเร็จ'
    } as ApiResponse<PurchaseOrderInfo>);

  } catch (error: any) {
    logger.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ'
    } as ApiResponse);
  }
};

/**
 * Get purchase orders with filtering
 */
export const getPurchaseOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      branchId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query as any;

    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    // Build filter conditions
    const where: any = {};
    
    if (currentBranchId) {
      where.branchId = currentBranchId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (dateFrom || dateTo) {
      where.requestedAt = {};
      if (dateFrom) where.requestedAt.gte = new Date(dateFrom);
      if (dateTo) where.requestedAt.lte = new Date(dateTo);
    }

    // Get total count
    const total = await prisma.purchaseOrder.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Get orders
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        requestedUser: true
      },
      orderBy: {
        requestedAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format response
    const ordersData: PurchaseOrderInfo[] = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      branchName: order.branch.name,
      requestedBy: order.requestedUser.fullName,
      status: order.status,
      totalItems: order.totalItems,
      totalQuantity: order.totalQuantity,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: order.notes || undefined,
      requestedAt: order.requestedAt,
      processedAt: order.processedAt || undefined,
      deliveredAt: order.deliveredAt || undefined
    }));

    res.json({
      success: true,
      data: ordersData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    } as PaginatedResponse<PurchaseOrderInfo>);

  } catch (error: any) {
    logger.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ'
    } as ApiResponse);
  }
};

/**
 * Get purchase order by ID
 */
export const getPurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentBranchId = req.user!.branchId;

    const order = await prisma.purchaseOrder.findFirst({
      where: {
        id,
        ...(req.user!.role !== 'ADMIN' && { branchId: currentBranchId })
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        requestedUser: true
      }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลใบสั่งซื้อ'
      } as ApiResponse);
      return;
    }

    const orderInfo: PurchaseOrderInfo = {
      id: order.id,
      orderNumber: order.orderNumber,
      branchName: order.branch.name,
      requestedBy: order.requestedUser.fullName,
      status: order.status,
      totalItems: order.totalItems,
      totalQuantity: order.totalQuantity,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: order.notes || undefined,
      requestedAt: order.requestedAt,
      processedAt: order.processedAt || undefined,
      deliveredAt: order.deliveredAt || undefined
    };

    res.json({
      success: true,
      data: orderInfo
    } as ApiResponse<PurchaseOrderInfo>);

  } catch (error: any) {
    logger.error('Get purchase order error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ'
    } as ApiResponse);
  }
};

/**
 * Update purchase order status (for warehouse staff)
 */
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status
    if (!Object.values(OrderStatus).includes(status)) {
      res.status(400).json({
        success: false,
        error: 'สถานะไม่ถูกต้อง'
      } as ApiResponse);
      return;
    }

    const updateData: any = {
      status,
      ...(notes && { notes })
    };

    // Add processed timestamp when status changes to PROCESSING
    if (status === OrderStatus.PROCESSING) {
      updateData.processedAt = new Date();
    }

    // Add delivered timestamp when status changes to DELIVERED
    if (status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        requestedUser: true
      }
    });

    const orderInfo: PurchaseOrderInfo = {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      branchName: updatedOrder.branch.name,
      requestedBy: updatedOrder.requestedUser.fullName,
      status: updatedOrder.status,
      totalItems: updatedOrder.totalItems,
      totalQuantity: updatedOrder.totalQuantity,
      items: updatedOrder.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: updatedOrder.notes || undefined,
      requestedAt: updatedOrder.requestedAt,
      processedAt: updatedOrder.processedAt || undefined,
      deliveredAt: updatedOrder.deliveredAt || undefined
    };

    // Emit real-time update to branch
    io.to(`branch:${updatedOrder.branchId}`).emit('purchase-order-updated', {
      order: orderInfo,
      timestamp: new Date()
    });

    logger.info(`Purchase order ${updatedOrder.orderNumber} status updated to ${status} by ${req.user!.username}`);

    res.json({
      success: true,
      data: orderInfo,
      message: 'อัปเดตสถานะใบสั่งซื้อสำเร็จ'
    } as ApiResponse<PurchaseOrderInfo>);

  } catch (error: any) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะใบสั่งซื้อ'
    } as ApiResponse);
  }
};

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const currentBranchId = req.user!.branchId;

    // Find order
    const order = await prisma.purchaseOrder.findFirst({
      where: {
        id,
        ...(req.user!.role !== 'ADMIN' && { branchId: currentBranchId })
      }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลใบสั่งซื้อ'
      } as ApiResponse);
      return;
    }

    // Check if order can be cancelled
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      res.status(400).json({
        success: false,
        error: 'ไม่สามารถยกเลิกใบสั่งซื้อนี้ได้'
      } as ApiResponse);
      return;
    }

    // Update order status
    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        notes: reason ? `ยกเลิก: ${reason}` : 'ยกเลิกโดยผู้ใช้'
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        requestedUser: true
      }
    });

    const orderInfo: PurchaseOrderInfo = {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      branchName: updatedOrder.branch.name,
      requestedBy: updatedOrder.requestedUser.fullName,
      status: updatedOrder.status,
      totalItems: updatedOrder.totalItems,
      totalQuantity: updatedOrder.totalQuantity,
      items: updatedOrder.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: updatedOrder.notes || undefined,
      requestedAt: updatedOrder.requestedAt,
      processedAt: updatedOrder.processedAt || undefined,
      deliveredAt: updatedOrder.deliveredAt || undefined
    };

    // Emit real-time update
    io.to('warehouse').emit('purchase-order-cancelled', {
      order: orderInfo,
      timestamp: new Date()
    });

    logger.info(`Purchase order ${updatedOrder.orderNumber} cancelled by ${req.user!.username}`);

    res.json({
      success: true,
      data: orderInfo,
      message: 'ยกเลิกใบสั่งซื้อสำเร็จ'
    } as ApiResponse<PurchaseOrderInfo>);

  } catch (error: any) {
    logger.error('Cancel purchase order error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการยกเลิกใบสั่งซื้อ'
    } as ApiResponse);
  }
};

/**
 * Get purchase order summary
 */
export const getPurchaseOrderSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId, dateFrom, dateTo } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    const where: any = {};
    
    if (currentBranchId) {
      where.branchId = currentBranchId;
    }
    
    if (dateFrom || dateTo) {
      where.requestedAt = {};
      if (dateFrom) where.requestedAt.gte = new Date(dateFrom);
      if (dateTo) where.requestedAt.lte = new Date(dateTo);
    }

    // Get summary data
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalQuantity
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.count({ where: { ...where, status: OrderStatus.PENDING } }),
      prisma.purchaseOrder.count({ where: { ...where, status: OrderStatus.PROCESSING } }),
      prisma.purchaseOrder.count({ where: { ...where, status: OrderStatus.DELIVERED } }),
      prisma.purchaseOrder.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      prisma.purchaseOrder.aggregate({
        where,
        _sum: {
          totalQuantity: true
        }
      })
    ]);

    const summary = {
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalQuantityOrdered: totalQuantity._sum.totalQuantity || 0,
      averageQuantityPerOrder: totalOrders > 0 ? Math.round((totalQuantity._sum.totalQuantity || 0) / totalOrders) : 0,
      fulfillmentRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
    };

    res.json({
      success: true,
      data: summary
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Get purchase order summary error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงสรุปข้อมูลใบสั่งซื้อ'
    } as ApiResponse);
  }
};