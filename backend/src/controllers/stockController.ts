import { Request, Response } from 'express';
import { prisma, logger, cacheUtils, cacheKeys, cacheTTL } from '../config/database';
import { 
  StockLevelInfo, 
  StockMovementInfo,
  LowStockAlert,
  ApiResponse, 
  PaginatedResponse,
  StockSearchFilter,
  StockMovementType
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

/**
 * Get stock levels for a branch (quantity-focused)
 * เน้นการแสดงจำนวนสต๊อคคงเหลือ
 */
export const getStockLevels = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      branchId,
      productName,
      category,
      lowStockOnly,
      unit,
      page = 1,
      limit = 50
    }: StockSearchFilter = req.query as any;

    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    // Build filter conditions
    const where: any = {
      branchId: currentBranchId
    };

    const productWhere: any = {};

    if (productName) {
      productWhere.name = {
        contains: productName,
        mode: 'insensitive'
      };
    }

    if (category) {
      productWhere.category = category;
    }

    if (unit) {
      productWhere.unit = unit;
    }

    if (Object.keys(productWhere).length > 0) {
      where.product = productWhere;
    }

    // Add low stock filter
    if (lowStockOnly === 'true') {
      where.quantity = {
        lte: prisma.stockLevel.fields.threshold
      };
    }

    // Get total count
    const total = await prisma.stockLevel.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Get stock levels
    const stockLevels = await prisma.stockLevel.findMany({
      where,
      include: {
        product: true,
        branch: true
      },
      orderBy: [
        {
          quantity: 'asc' // Show low stock first
        },
        {
          product: {
            name: 'asc'
          }
        }
      ],
      skip: (page - 1) * limit,
      take: limit
    });

    // Format response
    const stockData: StockLevelInfo[] = stockLevels.map(stock => ({
      id: stock.id,
      productId: stock.productId,
      productName: stock.product.name,
      productSku: stock.product.sku,
      unit: stock.product.unit,
      quantity: stock.quantity,
      threshold: stock.threshold,
      maxLevel: stock.maxLevel,
      isLowStock: stock.quantity <= stock.threshold,
      lastMovementAt: stock.lastMovementAt || undefined,
      branchId: stock.branchId,
      branchName: stock.branch.name
    }));

    res.json({
      success: true,
      data: stockData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    } as PaginatedResponse<StockLevelInfo>);

  } catch (error: any) {
    logger.error('Get stock levels error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสต๊อค'
    } as ApiResponse);
  }
};

/**
 * Get stock level for specific product in branch
 */
export const getProductStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { branchId } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    // Check cache first
    const cacheKey = cacheKeys.stockLevel(currentBranchId, productId);
    const cached = await cacheUtils.getCache<StockLevelInfo>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<StockLevelInfo>);
      return;
    }

    const stockLevel = await prisma.stockLevel.findUnique({
      where: {
        productId_branchId: {
          productId,
          branchId: currentBranchId
        }
      },
      include: {
        product: true,
        branch: true
      }
    });

    if (!stockLevel) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลสต๊อค'
      } as ApiResponse);
      return;
    }

    const stockInfo: StockLevelInfo = {
      id: stockLevel.id,
      productId: stockLevel.productId,
      productName: stockLevel.product.name,
      productSku: stockLevel.product.sku,
      unit: stockLevel.product.unit,
      quantity: stockLevel.quantity,
      threshold: stockLevel.threshold,
      maxLevel: stockLevel.maxLevel,
      isLowStock: stockLevel.quantity <= stockLevel.threshold,
      lastMovementAt: stockLevel.lastMovementAt || undefined,
      branchId: stockLevel.branchId,
      branchName: stockLevel.branch.name
    };

    // Cache for 5 minutes
    await cacheUtils.setCache(cacheKey, stockInfo, cacheTTL.stockLevel);

    res.json({
      success: true,
      data: stockInfo
    } as ApiResponse<StockLevelInfo>);

  } catch (error: any) {
    logger.error('Get product stock error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสต๊อค'
    } as ApiResponse);
  }
};

/**
 * Get stock movements history (quantity tracking)
 * ติดตามประวัติการเคลื่อนไหวของสต๊อค
 */
export const getStockMovements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      branchId,
      productId,
      type,
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
    
    if (productId) {
      where.productId = productId;
    }
    
    if (type) {
      where.type = type;
    }
    
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    // Get total count
    const total = await prisma.stockMovement.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Get movements
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
        branch: true,
        staff: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format response
    const movementData: StockMovementInfo[] = movements.map(movement => ({
      id: movement.id,
      productName: movement.product.name,
      productSku: movement.product.sku,
      type: movement.type,
      quantity: movement.quantity,
      previousQuantity: movement.previousQuantity,
      newQuantity: movement.newQuantity,
      reference: movement.reference || undefined,
      notes: movement.notes || undefined,
      staffName: movement.staff.fullName,
      timestamp: movement.timestamp,
      branchName: movement.branch.name
    }));

    res.json({
      success: true,
      data: movementData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    } as PaginatedResponse<StockMovementInfo>);

  } catch (error: any) {
    logger.error('Get stock movements error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงประวัติการเคลื่อนไหวสต๊อค'
    } as ApiResponse);
  }
};

/**
 * Update stock threshold for low stock alerts
 */
export const updateStockThreshold = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { threshold, maxLevel } = req.body;
    const currentBranchId = req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    const stockLevel = await prisma.stockLevel.update({
      where: {
        productId_branchId: {
          productId,
          branchId: currentBranchId
        }
      },
      data: {
        threshold: threshold !== undefined ? threshold : undefined,
        maxLevel: maxLevel !== undefined ? maxLevel : undefined
      },
      include: {
        product: true,
        branch: true
      }
    });

    // Clear cache
    await cacheUtils.deleteCache(cacheKeys.stockLevel(currentBranchId, productId));
    await cacheUtils.deleteCache(cacheKeys.lowStockAlerts(currentBranchId));

    const stockInfo: StockLevelInfo = {
      id: stockLevel.id,
      productId: stockLevel.productId,
      productName: stockLevel.product.name,
      productSku: stockLevel.product.sku,
      unit: stockLevel.product.unit,
      quantity: stockLevel.quantity,
      threshold: stockLevel.threshold,
      maxLevel: stockLevel.maxLevel,
      isLowStock: stockLevel.quantity <= stockLevel.threshold,
      lastMovementAt: stockLevel.lastMovementAt || undefined,
      branchId: stockLevel.branchId,
      branchName: stockLevel.branch.name
    };

    res.json({
      success: true,
      data: stockInfo,
      message: 'อัปเดตระดับสต๊อคสำเร็จ'
    } as ApiResponse<StockLevelInfo>);

  } catch (error: any) {
    logger.error('Update stock threshold error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัปเดตระดับสต๊อค'
    } as ApiResponse);
  }
};

/**
 * Manual stock adjustment
 * การปรับปรุงสต๊อคด้วยตนเอง
 */
export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { adjustment, reason } = req.body;
    const staffId = req.user!.id;
    const branchId = req.user!.branchId!;

    if (!branchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get current stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          productId_branchId: {
            productId,
            branchId
          }
        },
        include: {
          product: true
        }
      });

      if (!stockLevel) {
        throw new Error('ไม่พบข้อมูลสต๊อค');
      }

      const newQuantity = Math.max(0, stockLevel.quantity + adjustment);

      // Update stock level
      const updatedStock = await tx.stockLevel.update({
        where: {
          id: stockLevel.id
        },
        data: {
          quantity: newQuantity,
          lastMovementAt: new Date()
        },
        include: {
          product: true,
          branch: true
        }
      });

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          productId,
          branchId,
          type: StockMovementType.ADJUSTMENT,
          quantity: adjustment,
          previousQuantity: stockLevel.quantity,
          newQuantity,
          staffId,
          notes: reason || 'การปรับปรุงสต๊อคด้วยตนเอง'
        }
      });

      return updatedStock;
    });

    // Clear cache
    await cacheUtils.deleteCache(cacheKeys.stockLevel(branchId, productId));
    await cacheUtils.deleteCache(cacheKeys.lowStockAlerts(branchId));

    const stockInfo: StockLevelInfo = {
      id: result.id,
      productId: result.productId,
      productName: result.product.name,
      productSku: result.product.sku,
      unit: result.product.unit,
      quantity: result.quantity,
      threshold: result.threshold,
      maxLevel: result.maxLevel,
      isLowStock: result.quantity <= result.threshold,
      lastMovementAt: result.lastMovementAt || undefined,
      branchId: result.branchId,
      branchName: result.branch.name
    };

    // Emit real-time update
    io.to(`branch:${branchId}`).emit('stock-updated', {
      productId,
      branchId,
      newQuantity: result.quantity,
      isLowStock: result.quantity <= result.threshold
    });

    logger.info(`Stock adjusted: ${result.product.name} by ${adjustment} units by ${req.user!.username}`);

    res.json({
      success: true,
      data: stockInfo,
      message: 'ปรับปรุงสต๊อคสำเร็จ'
    } as ApiResponse<StockLevelInfo>);

  } catch (error: any) {
    logger.error('Adjust stock error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการปรับปรุงสต๊อค'
    } as ApiResponse);
  }
};

/**
 * Get low stock alerts
 * การแจ้งเตือนสินค้าใกล้หมด
 */
export const getLowStockAlerts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Check cache first
    const cacheKey = cacheKeys.lowStockAlerts(currentBranchId);
    const cached = await cacheUtils.getCache<LowStockAlert[]>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<LowStockAlert[]>);
      return;
    }

    // Get low stock items
    const lowStockItems = await prisma.stockLevel.findMany({
      where: {
        branchId: currentBranchId,
        quantity: {
          lte: prisma.stockLevel.fields.threshold
        }
      },
      include: {
        product: true,
        branch: true
      },
      orderBy: [
        {
          quantity: 'asc'
        },
        {
          product: {
            name: 'asc'
          }
        }
      ]
    });

    // Format alerts with urgency levels
    const alerts: LowStockAlert[] = lowStockItems.map(item => {
      const percentage = item.threshold > 0 ? (item.quantity / item.threshold) * 100 : 0;
      
      let urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (item.quantity === 0) {
        urgencyLevel = 'CRITICAL';
      } else if (percentage <= 25) {
        urgencyLevel = 'HIGH';
      } else if (percentage <= 50) {
        urgencyLevel = 'MEDIUM';
      } else {
        urgencyLevel = 'LOW';
      }

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        branchId: item.branchId,
        branchName: item.branch.name,
        currentQuantity: item.quantity,
        threshold: item.threshold,
        unit: item.product.unit,
        urgencyLevel,
        lastMovementAt: item.lastMovementAt || undefined
      };
    });

    // Cache for 10 minutes
    await cacheUtils.setCache(cacheKey, alerts, cacheTTL.lowStockAlerts);

    res.json({
      success: true,
      data: alerts
    } as ApiResponse<LowStockAlert[]>);

  } catch (error: any) {
    logger.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงการแจ้งเตือนสต๊อคต่ำ'
    } as ApiResponse);
  }
};

/**
 * Get stock summary for dashboard
 * สรุปข้อมูลสต๊อคสำหรับแดชบอร์ด
 */
export const getStockSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const [
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalQuantity
    ] = await Promise.all([
      // Total products in branch
      prisma.stockLevel.count({
        where: { branchId: currentBranchId }
      }),
      
      // Low stock count
      prisma.stockLevel.count({
        where: {
          branchId: currentBranchId,
          quantity: {
            lte: prisma.stockLevel.fields.threshold,
            gt: 0
          }
        }
      }),
      
      // Out of stock count
      prisma.stockLevel.count({
        where: {
          branchId: currentBranchId,
          quantity: 0
        }
      }),
      
      // Total quantity across all products
      prisma.stockLevel.aggregate({
        where: { branchId: currentBranchId },
        _sum: {
          quantity: true
        }
      })
    ]);

    const summary = {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalQuantity: totalQuantity._sum.quantity || 0,
      healthyStockCount: totalProducts - lowStockCount - outOfStockCount,
      stockHealthPercentage: totalProducts > 0 ? 
        Math.round(((totalProducts - lowStockCount - outOfStockCount) / totalProducts) * 100) : 100
    };

    res.json({
      success: true,
      data: summary
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Get stock summary error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงสรุปข้อมูลสต๊อค'
    } as ApiResponse);
  }
};