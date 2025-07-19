import { Request, Response } from 'express';
import { InventoryService } from '../services/InventoryService';
import { AuthenticatedRequest } from '../middleware/auth';
import { StockMovementType } from '@dried-fruits/types';
import logger from '../utils/logger';

export class InventoryController {
  private inventoryService = new InventoryService();

  createInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const item = await this.inventoryService.createInventoryItem(req.body, req.user.sub);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Inventory item created successfully',
      });
    } catch (error) {
      logger.error('Create inventory item failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  getInventoryItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const item = await this.inventoryService.getInventoryItem(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found',
        });
        return;
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      logger.error('Get inventory item failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getBranchInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const filters = req.query as any;

      const result = await this.inventoryService.getInventoryByBranch(branchId, filters);

      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: parseInt(filters.page) || 1,
          limit: parseInt(filters.limit) || 20,
          totalPages: Math.ceil(result.total / (parseInt(filters.limit) || 20)),
        },
        summary: result.summary,
      });
    } catch (error) {
      logger.error('Get branch inventory failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  updateInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const item = await this.inventoryService.updateInventoryItem(id, req.body, req.user.sub);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found',
        });
        return;
      }

      res.json({
        success: true,
        data: item,
        message: 'Inventory item updated successfully',
      });
    } catch (error) {
      logger.error('Update inventory item failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const result = await this.inventoryService.adjustStock(id, req.body, req.user.sub);

      res.json({
        success: true,
        data: {
          item: result.item,
          movement: result.movement,
        },
        message: 'Stock adjusted successfully',
      });
    } catch (error) {
      logger.error('Adjust stock failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  reserveStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { quantity, referenceId } = req.body;

      const item = await this.inventoryService.reserveStock(id, quantity, req.user.sub, referenceId);

      res.json({
        success: true,
        data: item,
        message: 'Stock reserved successfully',
      });
    } catch (error) {
      logger.error('Reserve stock failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  releaseReservedStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { quantity, referenceId } = req.body;

      const item = await this.inventoryService.releaseReservedStock(id, quantity, req.user.sub, referenceId);

      res.json({
        success: true,
        data: item,
        message: 'Reserved stock released successfully',
      });
    } catch (error) {
      logger.error('Release reserved stock failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  getStockMovements = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const filters = req.query as any;

      const result = await this.inventoryService.getStockMovements(id, filters);

      res.json({
        success: true,
        data: result.movements,
        pagination: {
          total: result.total,
          page: parseInt(filters.page) || 1,
          limit: parseInt(filters.limit) || 20,
          totalPages: Math.ceil(result.total / (parseInt(filters.limit) || 20)),
        },
      });
    } catch (error) {
      logger.error('Get stock movements failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getBranchStockMovements = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const filters = req.query as any;

      const result = await this.inventoryService.getBranchStockMovements(branchId, filters);

      res.json({
        success: true,
        data: result.movements,
        pagination: {
          total: result.total,
          page: parseInt(filters.page) || 1,
          limit: parseInt(filters.limit) || 20,
          totalPages: Math.ceil(result.total / (parseInt(filters.limit) || 20)),
        },
      });
    } catch (error) {
      logger.error('Get branch stock movements failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getStockSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const { startDate, endDate } = req.query;

      const period = (startDate && endDate) ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      } : undefined;

      const summary = await this.inventoryService.getStockSummary(branchId, period);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Get stock summary failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getLowStockItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const items = await this.inventoryService.getLowStockItems(branchId);

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error) {
      logger.error('Get low stock items failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getExpiringSoonItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const { days } = req.query;

      const items = await this.inventoryService.getExpiringSoonItems(
        branchId,
        days ? parseInt(days as string) : 30
      );

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error) {
      logger.error('Get expiring soon items failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  validateStockAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { requests } = req.body;
      const result = await this.inventoryService.validateStockAvailability(requests);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Validate stock availability failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };
}