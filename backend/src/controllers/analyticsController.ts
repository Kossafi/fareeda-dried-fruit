import { Request, Response } from 'express';
import { prisma, logger, cacheUtils, cacheKeys, cacheTTL } from '../config/database';
import { 
  ApiResponse, 
  SalesQuantityPattern,
  HourlyQuantitySales,
  DailyQuantityTrend,
  ProductQuantityRanking
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Get sales analytics overview (เน้นจำนวนสินค้า)
 */
export const getSalesAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Get analytics data
    const [
      totalSales,
      totalQuantitySold,
      avgQuantityPerSale,
      topSellingHour,
      peakSalesDay
    ] = await Promise.all([
      // Total sales count
      prisma.saleRecord.count({ where }),

      // Total quantity sold
      prisma.saleRecord.aggregate({
        where,
        _sum: {
          totalQuantity: true
        }
      }),

      // Average quantity per sale
      prisma.saleRecord.aggregate({
        where,
        _avg: {
          totalQuantity: true
        }
      }),

      // Top selling hour (mock data for now)
      Promise.resolve({ hour: 14, quantitySold: 0 }),

      // Peak sales day (mock data for now)  
      Promise.resolve({ dayOfWeek: 6, quantitySold: 0 })
    ]);

    const analytics = {
      overview: {
        totalSales,
        totalQuantitySold: totalQuantitySold._sum.totalQuantity || 0,
        averageQuantityPerSale: Math.round(avgQuantityPerSale._avg.totalQuantity || 0),
        averageSalesPerDay: totalSales > 0 ? Math.round(totalSales / 30) : 0 // Assuming 30 days
      },
      patterns: {
        peakHour: topSellingHour.hour,
        peakDay: peakSalesDay.dayOfWeek,
        bestPerformingTimeSlot: '14:00-15:00' // Peak hour range
      },
      trends: {
        growthRate: '+12.5%', // Mock data
        seasonality: 'High', // Mock data
        consistency: 85 // Mock consistency score
      }
    };

    res.json({
      success: true,
      data: analytics
    } as ApiResponse);

  } catch (error: any) {
    logger.error('Get sales analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลวิเคราะห์การขาย'
    } as ApiResponse);
  }
};

/**
 * Get hourly sales pattern (เน้นจำนวนสินค้าตามช่วงเวลา)
 */
export const getHourlySalesPattern = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId, date, days = 7 } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    // Check cache first
    const cacheKey = cacheKeys.salesPattern(currentBranchId, date || 'recent');
    const cached = await cacheUtils.getCache<HourlyQuantitySales[]>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<HourlyQuantitySales[]>);
      return;
    }

    // Calculate date range
    const endDate = date ? new Date(date) : new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // Get sales data grouped by hour
    const hourlyData = await prisma.$queryRaw<any[]>`
      SELECT 
        EXTRACT(HOUR FROM recorded_at) as hour,
        SUM(total_quantity) as quantity_sold,
        COUNT(*) as transaction_count
      FROM sale_records 
      WHERE branch_id = ${currentBranchId}
        AND recorded_at >= ${startDate}
        AND recorded_at <= ${endDate}
      GROUP BY EXTRACT(HOUR FROM recorded_at)
      ORDER BY hour
    `;

    // Format data for all 24 hours
    const hourlyPattern: HourlyQuantitySales[] = Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyData.find(d => parseInt(d.hour) === hour);
      return {
        hour,
        quantitySold: data ? parseInt(data.quantity_sold) : 0,
        transactionCount: data ? parseInt(data.transaction_count) : 0,
        topProduct: undefined // Would need additional query for top product per hour
      };
    });

    // Cache for 1 hour
    await cacheUtils.setCache(cacheKey, hourlyPattern, cacheTTL.salesPattern);

    res.json({
      success: true,
      data: hourlyPattern
    } as ApiResponse<HourlyQuantitySales[]>);

  } catch (error: any) {
    logger.error('Get hourly sales pattern error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรูปแบบการขายรายชั่วโมง'
    } as ApiResponse);
  }
};

/**
 * Get daily sales trend (เน้นจำนวนสินค้ารายวัน)
 */
export const getDailySalesTrend = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId, days = 30 } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    if (!currentBranchId) {
      res.status(400).json({
        success: false,
        error: 'ต้องระบุสาขา'
      } as ApiResponse);
      return;
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily sales data
    const dailyData = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(recorded_at) as date,
        SUM(total_quantity) as total_quantity_sold,
        COUNT(*) as total_transactions
      FROM sale_records 
      WHERE branch_id = ${currentBranchId}
        AND recorded_at >= ${startDate}
        AND recorded_at <= ${endDate}
      GROUP BY DATE(recorded_at)
      ORDER BY date
    `;

    // Format data
    const dailyTrend: DailyQuantityTrend[] = dailyData.map(data => ({
      date: new Date(data.date),
      totalQuantitySold: parseInt(data.total_quantity_sold),
      totalTransactions: parseInt(data.total_transactions),
      hourlyBreakdown: [] // Would need additional query for hourly breakdown per day
    }));

    res.json({
      success: true,
      data: dailyTrend
    } as ApiResponse<DailyQuantityTrend[]>);

  } catch (error: any) {
    logger.error('Get daily sales trend error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแนวโน้มการขายรายวัน'
    } as ApiResponse);
  }
};

/**
 * Get product ranking by quantity sold
 */
export const getProductRanking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { branchId, dateFrom, dateTo, limit = 20 } = req.query as any;
    const currentBranchId = req.user!.role === 'ADMIN' ? branchId : req.user!.branchId;

    const where: any = {};
    
    if (currentBranchId) {
      where.saleRecord = { branchId: currentBranchId };
    }
    
    if (dateFrom || dateTo) {
      where.saleRecord = {
        ...where.saleRecord,
        recordedAt: {}
      };
      if (dateFrom) where.saleRecord.recordedAt.gte = new Date(dateFrom);
      if (dateTo) where.saleRecord.recordedAt.lte = new Date(dateTo);
    }

    // Get product ranking by total quantity sold
    const productStats = await prisma.saleItem.groupBy({
      by: ['productId'],
      where,
      _sum: {
        quantity: true
      },
      _count: true,
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: limit
    });

    // Get product details
    const productIds = productStats.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    });

    const productMap = products.reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {} as any);

    // Format ranking
    const ranking: ProductQuantityRanking[] = productStats.map((item, index) => ({
      rank: index + 1,
      productId: item.productId,
      productName: productMap[item.productId]?.name || 'Unknown',
      productSku: productMap[item.productId]?.sku || 'Unknown',
      totalQuantitySold: item._sum.quantity || 0,
      totalTransactions: item._count,
      unit: productMap[item.productId]?.unit
    }));

    res.json({
      success: true,
      data: ranking
    } as ApiResponse<ProductQuantityRanking[]>);

  } catch (error: any) {
    logger.error('Get product ranking error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอันดับสินค้า'
    } as ApiResponse);
  }
};