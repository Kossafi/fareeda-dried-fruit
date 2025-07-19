import { Request, Response } from 'express';
import { RepackService } from '../services/RepackService';
import { AuthenticatedRequest } from '../middleware/auth';
import { RepackOrderStatus } from '@dried-fruits/types';
import logger from '../utils/logger';

export class RepackController {
  private repackService = new RepackService();

  createRepackOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const order = await this.repackService.createRepackOrder(req.body, req.user.sub);

      res.status(201).json({
        success: true,
        data: order,
        message: 'Repack order created successfully',
      });
    } catch (error) {
      logger.error('Create repack order failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  getRepackOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const order = await this.repackService.getRepackOrder(id);

      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Repack order not found',
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error('Get repack order failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getBranchRepackOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const filters = req.query as any;

      const result = await this.repackService.getBranchRepackOrders(branchId, filters);

      res.json({
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          page: parseInt(filters.page) || 1,
          limit: parseInt(filters.limit) || 20,
          totalPages: Math.ceil(result.total / (parseInt(filters.limit) || 20)),
        },
      });
    } catch (error) {
      logger.error('Get branch repack orders failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  startRepackOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { supervisedBy } = req.body;

      const order = await this.repackService.startRepackOrder(id, req.user.sub, supervisedBy);

      res.json({
        success: true,
        data: order,
        message: 'Repack order started successfully',
      });
    } catch (error) {
      logger.error('Start repack order failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  completeRepackOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const actualResults = req.body;

      const order = await this.repackService.completeRepackOrder(id, actualResults, req.user.sub);

      res.json({
        success: true,
        data: order,
        message: 'Repack order completed successfully',
      });
    } catch (error) {
      logger.error('Complete repack order failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  cancelRepackOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Cancellation reason is required',
        });
        return;
      }

      const order = await this.repackService.cancelRepackOrder(id, reason, req.user.sub);

      res.json({
        success: true,
        data: order,
        message: 'Repack order cancelled successfully',
      });
    } catch (error) {
      logger.error('Cancel repack order failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  validateRepackFeasibility = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.repackService.validateRepackFeasibility(id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Validate repack feasibility failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  getReadyForProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.query;
      const orders = await this.repackService.getReadyForProcessing(branchId as string);

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      logger.error('Get ready for processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getEfficiencyReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const { startDate, endDate } = req.query;

      const period = (startDate && endDate) ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      } : undefined;

      const report = await this.repackService.getRepackEfficiencyReport(branchId, period);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Get efficiency report failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  getSuggestedOpportunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const suggestions = await this.repackService.suggestRepackOpportunities(branchId);

      res.json({
        success: true,
        data: suggestions,
        count: suggestions.length,
      });
    } catch (error) {
      logger.error('Get suggested opportunities failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
}