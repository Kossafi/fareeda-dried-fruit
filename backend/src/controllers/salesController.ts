import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, logger, cacheUtils, cacheKeys, cacheTTL } from '../config/database';
import { 
  SaleRecordRequest, 
  SaleRecordInfo, 
  ApiResponse, 
  PaginatedResponse,
  SalesSearchFilter,
  StockMovementType
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

// Generate sale number
const generateSaleNumber = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `SALE${dateStr}${timeStr}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

/**
 * Record a new sale and automatically deduct stock
 * เน้นการบันทึกจำนวนสินค้าและหักสต๊อคอัตโนมัติ
 */
export const recordSale = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { items, notes }: SaleRecordRequest = req.body;
    const staffId = req.user!.id;
    const branchId = req.user!.branchId!;

    // Validate items
    if (!items || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'ต้องมีสินค้าอย่างน้อย 1 รายการ'
      } as ApiResponse);
      return;
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check stock availability for all items
      const stockChecks = await Promise.all(
        items.map(async (item) => {
          const stockLevel = await tx.stockLevel.findUnique({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: branchId
              }
            },
            include: {
              product: true
            }
          });

          if (!stockLevel) {
            throw new Error(`ไม่พบข้อมูลสต๊อคสำหรับสินค้า ${item.productId}`);
          }

          if (stockLevel.quantity < item.quantity) {
            throw new Error(`สต๊อคไม่เพียงพอสำหรับ ${stockLevel.product.name} (คงเหลือ: ${stockLevel.quantity}, ต้องการ: ${item.quantity})`);
          }

          return { stockLevel, item };
        })
      );

      // Create sale record
      const saleNumber = generateSaleNumber();
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      const saleRecord = await tx.saleRecord.create({
        data: {
          saleNumber,
          branchId,
          staffId,
          totalQuantity,
          totalItems: items.length,
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
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
          staff: true
        }
      });

      // Update stock levels and create stock movements
      const stockUpdates = await Promise.all(
        stockChecks.map(async ({ stockLevel, item }) => {
          const newQuantity = stockLevel.quantity - item.quantity;

          // Update stock level
          const updatedStock = await tx.stockLevel.update({
            where: {
              id: stockLevel.id
            },
            data: {
              quantity: newQuantity,
              lastMovementAt: new Date()
            }
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              branchId,
              type: StockMovementType.SALE,
              quantity: -item.quantity, // Negative for sale
              previousQuantity: stockLevel.quantity,
              newQuantity,
              reference: saleRecord.id,
              staffId,
              notes: `การขาย ${saleRecord.saleNumber}`
            }
          });

          return {
            productId: item.productId,
            previousQuantity: stockLevel.quantity,
            newQuantity,
            threshold: stockLevel.threshold
          };
        })
      );

      return { saleRecord, stockUpdates };
    });

    // Format response
    const saleInfo: SaleRecordInfo = {
      id: result.saleRecord.id,
      saleNumber: result.saleRecord.saleNumber,
      branchName: result.saleRecord.branch.name,
      staffName: result.saleRecord.staff.fullName,
      totalQuantity: result.saleRecord.totalQuantity,
      totalItems: result.saleRecord.totalItems,
      items: result.saleRecord.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: result.saleRecord.notes || undefined,
      recordedAt: result.saleRecord.recordedAt
    };

    // Clear relevant caches
    await Promise.all([
      ...result.stockUpdates.map(update => 
        cacheUtils.deleteCache(cacheKeys.stockLevel(branchId, update.productId))
      ),
      cacheUtils.deleteCache(cacheKeys.lowStockAlerts(branchId)),
      cacheUtils.deleteCachePattern(`sales:pattern:${branchId}:*`)
    ]);

    // Emit real-time updates
    io.to(`branch:${branchId}`).emit('sale-recorded', {
      saleRecord: saleInfo,
      stockUpdates: result.stockUpdates
    });

    // Check for low stock alerts
    const lowStockProducts = result.stockUpdates.filter(
      update => update.newQuantity <= update.threshold
    );

    if (lowStockProducts.length > 0) {
      io.to(`branch:${branchId}`).emit('low-stock-alert', {
        branchId,
        products: lowStockProducts
      });
    }

    logger.info(`Sale recorded: ${result.saleRecord.saleNumber} by ${req.user!.username}`);

    res.status(201).json({
      success: true,
      data: saleInfo,
      message: 'บันทึกการขายสำเร็จ'
    } as ApiResponse<SaleRecordInfo>);

  } catch (error: any) {
    logger.error('Record sale error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย'
    } as ApiResponse);
  }
};

/**
 * Get sales records with filtering and pagination
 * เน้นการแสดงจำนวนสินค้าที่ขาย
 */
export const getSalesRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      branchId,
      staffId,
      dateFrom,
      dateTo,
      productId,
      page = 1,
      limit = 20
    }: SalesSearchFilter = req.query as any;

    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    // Build filter conditions
    const where: any = {};
    
    if (currentBranchId) {
      where.branchId = currentBranchId;
    }
    
    if (staffId) {
      where.staffId = staffId;
    }
    
    if (dateFrom || dateTo) {
      where.recordedAt = {};
      if (dateFrom) where.recordedAt.gte = new Date(dateFrom);
      if (dateTo) where.recordedAt.lte = new Date(dateTo);
    }
    
    if (productId) {
      where.items = {
        some: {
          productId
        }
      };
    }

    // Get total count
    const total = await prisma.saleRecord.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Get records
    const records = await prisma.saleRecord.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        branch: true,
        staff: true
      },
      orderBy: {
        recordedAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format response
    const salesData: SaleRecordInfo[] = records.map(record => ({
      id: record.id,
      saleNumber: record.saleNumber,
      branchName: record.branch.name,
      staffName: record.staff.fullName,
      totalQuantity: record.totalQuantity,
      totalItems: record.totalItems,
      items: record.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: record.notes || undefined,
      recordedAt: record.recordedAt
    }));

    res.json({
      success: true,
      data: salesData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    } as PaginatedResponse<SaleRecordInfo>);

  } catch (error: any) {
    logger.error('Get sales records error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการขาย'
    } as ApiResponse);
  }
};

/**
 * Get sale record by ID
 */
export const getSaleRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentBranchId = req.user!.branchId;

    const record = await prisma.saleRecord.findFirst({
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
        staff: true
      }
    });

    if (!record) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลการขาย'
      } as ApiResponse);
      return;
    }

    const saleInfo: SaleRecordInfo = {
      id: record.id,
      saleNumber: record.saleNumber,
      branchName: record.branch.name,
      staffName: record.staff.fullName,
      totalQuantity: record.totalQuantity,
      totalItems: record.totalItems,
      items: record.items.map(item => ({
        id: item.id,
        productName: item.product.name,
        productSku: item.product.sku,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || undefined
      })),
      notes: record.notes || undefined,
      recordedAt: record.recordedAt
    };

    res.json({
      success: true,
      data: saleInfo
    } as ApiResponse<SaleRecordInfo>);

  } catch (error: any) {
    logger.error('Get sale record error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการขาย'
    } as ApiResponse);
  }
};

/**
 * Get sales summary (quantity-focused)
 * เน้นสรุปจำนวนสินค้าที่ขาย
 */
export const getSalesSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId, dateFrom, dateTo } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    const where: any = {};
    
    if (currentBranchId) {
      where.branchId = currentBranchId;
    }
    
    if (dateFrom || dateTo) {
      where.recordedAt = {};
      if (dateFrom) where.recordedAt.gte = new Date(dateFrom);
      if (dateTo) where.recordedAt.lte = new Date(dateTo);
    }

    // Get summary data
    const [
      totalRecords,
      totalQuantity,
      topProducts
    ] = await Promise.all([
      // Total sales records
      prisma.saleRecord.count({ where }),
      
      // Total quantity sold
      prisma.saleRecord.aggregate({
        where,
        _sum: {
          totalQuantity: true
        }
      }),
      
      // Top selling products by quantity
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          saleRecord: where
        },
        _sum: {
          quantity: true
        },
        _count: true,
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 10
      })
    ]);

    // Get product details for top products
    const productIds = topProducts.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    });

    const productMap = products.reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {} as any);

    const topProductsWithDetails = topProducts.map((item, index) => ({
      rank: index + 1,
      productId: item.productId,
      productName: productMap[item.productId]?.name || 'Unknown',
      productSku: productMap[item.productId]?.sku || 'Unknown',
      totalQuantitySold: item._sum.quantity || 0,
      totalTransactions: item._count,
      unit: productMap[item.productId]?.unit
    }));

    const summary = {
      totalRecords,
      totalQuantitySold: totalQuantity._sum.totalQuantity || 0,
      averageQuantityPerSale: totalRecords > 0 ? Math.round((totalQuantity._sum.totalQuantity || 0) / totalRecords) : 0,
      topProducts: topProductsWithDetails
    };

    res.json({
      success: true,
      data: summary
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Get sales summary error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงสรุปข้อมูลการขาย'
    } as ApiResponse);
  }
};