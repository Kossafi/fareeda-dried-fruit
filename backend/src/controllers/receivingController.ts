import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, logger, cacheUtils, cacheKeys } from '../config/database';
import { 
  StockReceivingRequest, 
  StockReceivingInfo, 
  ApiResponse, 
  PaginatedResponse,
  StockMovementType,
  OrderStatus
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

// Generate receiving number
const generateReceivingNumber = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `GR${dateStr}${timeStr}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

/**
 * Create stock receiving record (เน้นการรับสินค้าตามจำนวน)
 */
export const createStockReceiving = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { purchaseOrderId, items, notes }: StockReceivingRequest = req.body;
    const receivedBy = req.user!.id;
    const branchId = req.user!.branchId!;

    // Validate purchase order
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        branchId,
        status: OrderStatus.DELIVERED
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!purchaseOrder) {
      res.status(400).json({
        success: false,
        error: 'ไม่พบใบสั่งซื้อหรือสถานะไม่ถูกต้อง'
      } as ApiResponse);
      return;
    }

    // Check if already received
    const existingReceiving = await prisma.stockReceiving.findFirst({
      where: { purchaseOrderId }
    });

    if (existingReceiving) {
      res.status(400).json({
        success: false,
        error: 'ใบสั่งซื้อนี้ได้รับสินค้าแล้ว'
      } as ApiResponse);
      return;
    }

    // Validate items match purchase order
    const orderItemsMap = purchaseOrder.items.reduce((map, item) => {
      map[item.productId] = item;
      return map;
    }, {} as any);

    for (const item of items) {
      if (!orderItemsMap[item.productId]) {
        res.status(400).json({
          success: false,
          error: `สินค้า ${item.productId} ไม่อยู่ในใบสั่งซื้อ`
        } as ApiResponse);
        return;
      }
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create receiving record
      const receivingNumber = generateReceivingNumber();
      const totalItemsOrdered = purchaseOrder.items.length;
      const totalItemsReceived = items.length;
      const totalQuantityOrdered = purchaseOrder.totalQuantity;
      const totalQuantityReceived = items.reduce((sum, item) => sum + item.receivedQuantity, 0);
      
      let hasDiscrepancies = false;
      const receivingItems = [];

      // Process each item
      for (const item of items) {
        const orderedItem = orderItemsMap[item.productId];
        const discrepancy = item.receivedQuantity - orderedItem.requestedQuantity;
        
        if (discrepancy !== 0) {
          hasDiscrepancies = true;
        }

        receivingItems.push({
          productId: item.productId,
          orderedQuantity: orderedItem.requestedQuantity,
          receivedQuantity: item.receivedQuantity,
          discrepancy,
          unit: orderedItem.unit,
          notes: item.notes
        });
      }

      // Create stock receiving
      const stockReceiving = await tx.stockReceiving.create({
        data: {
          receivingNumber,
          purchaseOrderId,
          branchId,
          receivedBy,
          totalItemsOrdered,
          totalItemsReceived,
          totalQuantityOrdered,
          totalQuantityReceived,
          hasDiscrepancies,
          notes,
          items: {
            create: receivingItems
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          purchaseOrder: true,
          branch: true,
          receivedUser: true
        }
      });

      // Update stock levels and create stock movements
      const stockUpdates = [];
      
      for (const item of receivingItems) {
        if (item.receivedQuantity <= 0) continue;

        // Find or create stock level
        let stockLevel = await tx.stockLevel.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId
            }
          }
        });

        const newQuantity = (stockLevel?.quantity || 0) + item.receivedQuantity;

        if (stockLevel) {
          // Update existing stock level
          stockLevel = await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: {
              quantity: newQuantity,
              lastMovementAt: new Date()
            }
          });
        } else {
          // Create new stock level
          stockLevel = await tx.stockLevel.create({
            data: {
              productId: item.productId,
              branchId,
              quantity: item.receivedQuantity,
              threshold: parseInt(process.env.DEFAULT_STOCK_THRESHOLD || '10'),
              maxLevel: parseInt(process.env.MAX_STOCK_LEVEL || '1000'),
              lastMovementAt: new Date()
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId,
            type: StockMovementType.RECEIVE,
            quantity: item.receivedQuantity,
            previousQuantity: (stockLevel.quantity || 0) - item.receivedQuantity,
            newQuantity: stockLevel.quantity,
            reference: stockReceiving.id,
            staffId: receivedBy,
            notes: `รับสินค้าจาก PO: ${purchaseOrder.orderNumber}`
          }
        });

        stockUpdates.push({
          productId: item.productId,
          previousQuantity: (stockLevel.quantity || 0) - item.receivedQuantity,
          newQuantity: stockLevel.quantity,
          receivedQuantity: item.receivedQuantity
        });
      }

      return { stockReceiving, stockUpdates };
    });

    // Format response
    const receivingInfo: StockReceivingInfo = {
      id: result.stockReceiving.id,
      receivingNumber: result.stockReceiving.receivingNumber,
      purchaseOrderNumber: result.stockReceiving.purchaseOrder.orderNumber,
      branchName: result.stockReceiving.branch.name,
      receivedBy: result.stockReceiving.receivedUser.fullName,
      totalItemsOrdered: result.stockReceiving.totalItemsOrdered,
      totalItemsReceived: result.stockReceiving.totalItemsReceived,
      totalQuantityOrdered: result.stockReceiving.totalQuantityOrdered,
      totalQuantityReceived: result.stockReceiving.totalQuantityReceived,
      hasDiscrepancies: result.stockReceiving.hasDiscrepancies,
      items: result.stockReceiving.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        discrepancy: item.discrepancy,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: result.stockReceiving.notes || undefined,
      receivedAt: result.stockReceiving.receivedAt
    };

    // Clear relevant caches
    await Promise.all([
      ...result.stockUpdates.map(update => 
        cacheUtils.deleteCache(cacheKeys.stockLevel(branchId, update.productId))
      ),
      cacheUtils.deleteCache(cacheKeys.lowStockAlerts(branchId))
    ]);

    // Emit real-time updates
    io.to(`branch:${branchId}`).emit('stock-received', {
      receiving: receivingInfo,
      stockUpdates: result.stockUpdates
    });

    if (result.stockReceiving.hasDiscrepancies) {
      io.to(`branch:${branchId}`).emit('receiving-discrepancy', {
        receiving: receivingInfo,
        timestamp: new Date()
      });
    }

    logger.info(`Stock receiving created: ${result.stockReceiving.receivingNumber} by ${req.user!.username}`);

    res.status(201).json({
      success: true,
      data: receivingInfo,
      message: 'บันทึกการรับสินค้าสำเร็จ'
    } as ApiResponse<StockReceivingInfo>);

  } catch (error: any) {
    logger.error('Create stock receiving error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการบันทึกการรับสินค้า'
    } as ApiResponse);
  }
};

/**
 * Get stock receiving records
 */
export const getStockReceivings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      branchId,
      dateFrom,
      dateTo,
      hasDiscrepancies,
      page = 1,
      limit = 20
    } = req.query as any;

    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    // Build filter conditions
    const where: any = {};
    
    if (currentBranchId) {
      where.branchId = currentBranchId;
    }
    
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo) where.receivedAt.lte = new Date(dateTo);
    }

    if (hasDiscrepancies !== undefined) {
      where.hasDiscrepancies = hasDiscrepancies === 'true';
    }

    // Get total count
    const total = await prisma.stockReceiving.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Get receiving records
    const receivings = await prisma.stockReceiving.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        purchaseOrder: true,
        branch: true,
        receivedUser: true
      },
      orderBy: {
        receivedAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format response
    const receivingsData: StockReceivingInfo[] = receivings.map(receiving => ({
      id: receiving.id,
      receivingNumber: receiving.receivingNumber,
      purchaseOrderNumber: receiving.purchaseOrder.orderNumber,
      branchName: receiving.branch.name,
      receivedBy: receiving.receivedUser.fullName,
      totalItemsOrdered: receiving.totalItemsOrdered,
      totalItemsReceived: receiving.totalItemsReceived,
      totalQuantityOrdered: receiving.totalQuantityOrdered,
      totalQuantityReceived: receiving.totalQuantityReceived,
      hasDiscrepancies: receiving.hasDiscrepancies,
      items: receiving.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        discrepancy: item.discrepancy,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: receiving.notes || undefined,
      receivedAt: receiving.receivedAt
    }));

    res.json({
      success: true,
      data: receivingsData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    } as PaginatedResponse<StockReceivingInfo>);

  } catch (error: any) {
    logger.error('Get stock receivings error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการรับสินค้า'
    } as ApiResponse);
  }
};

/**
 * Get stock receiving by ID
 */
export const getStockReceiving = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentBranchId = req.user!.branchId;

    const receiving = await prisma.stockReceiving.findFirst({
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
        purchaseOrder: true,
        branch: true,
        receivedUser: true
      }
    });

    if (!receiving) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลการรับสินค้า'
      } as ApiResponse);
      return;
    }

    const receivingInfo: StockReceivingInfo = {
      id: receiving.id,
      receivingNumber: receiving.receivingNumber,
      purchaseOrderNumber: receiving.purchaseOrder.orderNumber,
      branchName: receiving.branch.name,
      receivedBy: receiving.receivedUser.fullName,
      totalItemsOrdered: receiving.totalItemsOrdered,
      totalItemsReceived: receiving.totalItemsReceived,
      totalQuantityOrdered: receiving.totalQuantityOrdered,
      totalQuantityReceived: receiving.totalQuantityReceived,
      hasDiscrepancies: receiving.hasDiscrepancies,
      items: receiving.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        discrepancy: item.discrepancy,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: receiving.notes || undefined,
      receivedAt: receiving.receivedAt
    };

    res.json({
      success: true,
      data: receivingInfo
    } as ApiResponse<StockReceivingInfo>);

  } catch (error: any) {
    logger.error('Get stock receiving error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการรับสินค้า'
    } as ApiResponse);
  }
};

/**
 * Get pending delivery orders (ready to receive)
 */
export const getPendingDeliveries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    // Get delivered orders that haven't been received yet
    const pendingOrders = await prisma.purchaseOrder.findMany({
      where: {
        branchId: currentBranchId,
        status: OrderStatus.DELIVERED,
        receiving: null // No receiving record yet
      },
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
        deliveredAt: 'asc'
      }
    });

    // Format response
    const pendingData = pendingOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      branchName: order.branch.name,
      requestedBy: order.requestedUser.fullName,
      totalItems: order.totalItems,
      totalQuantity: order.totalQuantity,
      deliveredAt: order.deliveredAt,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        requestedQuantity: item.requestedQuantity,
        unit: item.unit
      }))
    }));

    res.json({
      success: true,
      data: pendingData
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Get pending deliveries error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงรายการสินค้าที่รอรับ'
    } as ApiResponse);
  }
};