import { Request, Response } from 'express';
import Joi from 'joi';
import ProcurementManagementService from '../services/ProcurementManagementService';
import PurchaseOrder from '../models/PurchaseOrder';
import Supplier from '../models/Supplier';
import GoodsReceipt from '../models/GoodsReceipt';
import { 
  PurchaseOrderStatus,
  UrgencyLevel,
  ApprovalAction,
  SupplierType,
  QualityCheckStatus
} from '@dried-fruits/types';
import logger from '../utils/logger';

const procurementService = new ProcurementManagementService();
const purchaseOrder = new PurchaseOrder();
const supplier = new Supplier();
const goodsReceipt = new GoodsReceipt();

// Validation schemas
const createOrderSchema = Joi.object({
  supplierId: Joi.string().uuid().required(),
  branchId: Joi.string().uuid().required(),
  urgency: Joi.string().valid(...Object.values(UrgencyLevel)).optional(),
  requiredDate: Joi.date().optional(),
  notes: Joi.string().max(1000).optional(),
  sourceAlertId: Joi.string().uuid().optional(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().uuid().required(),
      quantity: Joi.number().positive().required(),
      unitCost: Joi.number().min(0).optional(),
      notes: Joi.string().max(500).optional()
    })
  ).min(1).required()
});

const autoOrderSchema = Joi.object({
  alertId: Joi.string().uuid().required(),
  supplierId: Joi.string().uuid().optional(),
  urgency: Joi.string().valid(...Object.values(UrgencyLevel)).optional(),
  notes: Joi.string().max(1000).optional()
});

const approveOrderSchema = Joi.object({
  action: Joi.string().valid(...Object.values(ApprovalAction)).required(),
  comments: Joi.string().max(1000).optional(),
  approvedAmount: Joi.number().min(0).optional()
});

const updateOrderSchema = Joi.object({
  urgency: Joi.string().valid(...Object.values(UrgencyLevel)).optional(),
  requiredDate: Joi.date().optional(),
  expectedDeliveryDate: Joi.date().optional(),
  notes: Joi.string().max(1000).optional(),
  internalNotes: Joi.string().max(1000).optional(),
  supplierReference: Joi.string().max(100).optional(),
  trackingNumber: Joi.string().max(100).optional()
});

const receiveGoodsSchema = Joi.object({
  purchaseOrderId: Joi.string().uuid().required(),
  deliveryNoteNumber: Joi.string().max(100).optional(),
  invoiceNumber: Joi.string().max(100).optional(),
  qualityNotes: Joi.string().max(1000).optional(),
  items: Joi.array().items(
    Joi.object({
      purchaseOrderItemId: Joi.string().uuid().required(),
      quantityReceived: Joi.number().positive().required(),
      unitCost: Joi.number().min(0).optional(),
      qualityGrade: Joi.string().max(20).optional(),
      expirationDate: Joi.date().optional(),
      batchNumber: Joi.string().max(100).optional(),
      conditionNotes: Joi.string().max(500).optional(),
      isAccepted: Joi.boolean().optional(),
      rejectionReason: Joi.string().max(500).optional()
    })
  ).min(1).required()
});

const supplierSchema = Joi.object({
  supplierCode: Joi.string().max(20).optional(),
  companyName: Joi.string().max(255).required(),
  contactPerson: Joi.string().max(255).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().max(50).optional(),
  address: Joi.string().optional(),
  taxId: Joi.string().max(50).optional(),
  paymentTerms: Joi.number().integer().min(0).optional(),
  creditLimit: Joi.number().min(0).optional(),
  currencyCode: Joi.string().length(3).optional(),
  supplierType: Joi.string().valid(...Object.values(SupplierType)).optional(),
  leadTimeDays: Joi.number().integer().min(1).optional(),
  minimumOrderAmount: Joi.number().min(0).optional(),
  discountPercentage: Joi.number().min(0).max(100).optional(),
  notes: Joi.string().optional()
});

// Create purchase order from low stock alert
export const createOrderFromAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = autoOrderSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const result = await procurementService.createOrderFromAlert(
      value.alertId,
      req.user?.id || 'system',
      value
    );

    logger.info('Purchase order created from alert', {
      alertId: value.alertId,
      poId: result.order.id,
      poNumber: result.order.poNumber,
      requestedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created from alert successfully',
      data: {
        order: result.order,
        items: result.items
      }
    });

  } catch (error) {
    logger.error('Create order from alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create purchase order from alert'
    });
  }
};

// Create manual purchase order
export const createPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const result = await procurementService.createPurchaseOrder(
      value,
      req.user?.id || 'system'
    );

    logger.info('Purchase order created', {
      poId: result.order.id,
      poNumber: result.order.poNumber,
      supplierId: value.supplierId,
      totalAmount: result.order.totalAmount,
      requestedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        order: result.order,
        items: result.items
      }
    });

  } catch (error) {
    logger.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create purchase order'
    });
  }
};

// Update purchase order
export const updatePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { error, value } = updateOrderSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const order = await purchaseOrder.update(orderId, value);

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: order
    });

  } catch (error) {
    logger.error('Update purchase order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update purchase order'
    });
  }
};

// Submit for approval
export const submitForApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await procurementService.submitForApproval(
      orderId,
      req.user?.id || 'system'
    );

    res.json({
      success: true,
      message: 'Purchase order submitted for approval',
      data: order
    });

  } catch (error) {
    logger.error('Submit for approval error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit for approval'
    });
  }
};

// Approve/reject purchase order
export const approvePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { error, value } = approveOrderSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const userRole = req.user?.role || 'user';
    const action = value.action === ApprovalAction.APPROVE ? 'approve' : 'reject';

    const order = await procurementService.processApproval(
      orderId,
      req.user?.id || 'system',
      userRole,
      action,
      value.comments,
      value.approvedAmount
    );

    logger.info('Purchase order approval processed', {
      orderId,
      action: value.action,
      approverId: req.user?.id,
      finalStatus: order.status
    });

    res.json({
      success: true,
      message: `Purchase order ${action}ed successfully`,
      data: order
    });

  } catch (error) {
    logger.error('Approve purchase order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process approval'
    });
  }
};

// Get pending approvals
export const getPendingApprovals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role || 'user';
    const userId = req.user?.id || '';

    const orders = await purchaseOrder.getPendingApprovalsForUser(userId, userRole);

    res.json({
      success: true,
      data: orders,
      meta: {
        count: orders.length,
        userRole
      }
    });

  } catch (error) {
    logger.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending approvals'
    });
  }
};

// Receive goods
export const receiveGoods = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = receiveGoodsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    value.receivedBy = req.user?.id || 'system';

    const result = await procurementService.receiveGoods(value);

    logger.info('Goods received', {
      purchaseOrderId: value.purchaseOrderId,
      receiptId: result.receipt.id,
      receiptNumber: result.receipt.receiptNumber,
      receivedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Goods received successfully',
      data: {
        receipt: result.receipt,
        items: result.items
      }
    });

  } catch (error) {
    logger.error('Receive goods error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to receive goods'
    });
  }
};

// Update purchase order status
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    if (!status || !Object.values(PurchaseOrderStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
      return;
    }

    const order = await purchaseOrder.updateStatus(
      orderId,
      status,
      req.user?.id || 'system',
      notes
    );

    res.json({
      success: true,
      message: 'Purchase order status updated',
      data: order
    });

  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    });
  }
};

// Send to supplier
export const sendToSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await purchaseOrder.sendToSupplier(
      orderId,
      req.user?.id || 'system'
    );

    res.json({
      success: true,
      message: 'Purchase order sent to supplier',
      data: order
    });

  } catch (error) {
    logger.error('Send to supplier error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send to supplier'
    });
  }
};

// Get purchase order by ID
export const getPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await purchaseOrder.getById(orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
      return;
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    logger.error('Get purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve purchase order'
    });
  }
};

// Get purchase orders with filters
export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      status: req.query.status ? (req.query.status as string).split(',') as PurchaseOrderStatus[] : undefined,
      supplierId: req.query.supplierId as string,
      branchId: req.query.branchId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      urgency: req.query.urgency ? (req.query.urgency as string).split(',') as UrgencyLevel[] : undefined,
      amountMin: req.query.amountMin ? parseFloat(req.query.amountMin as string) : undefined,
      amountMax: req.query.amountMax ? parseFloat(req.query.amountMax as string) : undefined,
      requestedBy: req.query.requestedBy as string,
      search: req.query.search as string
    };

    const result = await procurementService.getPurchaseOrders(filters);

    res.json({
      success: true,
      data: result.orders,
      meta: {
        total: result.total,
        count: result.orders.length,
        filters
      }
    });

  } catch (error) {
    logger.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve purchase orders'
    });
  }
};

// Get supplier recommendations
export const getSupplierRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { quantity, branchId } = req.query;

    const recommendations = await procurementService.getSupplierRecommendations(
      productId,
      quantity ? parseFloat(quantity as string) : 1,
      branchId as string
    );

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    logger.error('Get supplier recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supplier recommendations'
    });
  }
};

// Get supplier performance
export const getSupplierPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId } = req.params;
    const { dateFrom, dateTo } = req.query;

    const report = await procurementService.getSupplierPerformanceReport(
      supplierId,
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Get supplier performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supplier performance'
    });
  }
};

// Get procurement dashboard
export const getProcurementDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, dateFrom, dateTo } = req.query;

    const dashboard = await procurementService.getProcurementDashboard(
      branchId as string,
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    logger.error('Get procurement dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get procurement dashboard'
    });
  }
};

// Create supplier
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = supplierSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    value.createdBy = req.user?.id || 'system';

    const newSupplier = await supplier.create(value);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: newSupplier
    });

  } catch (error) {
    logger.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create supplier'
    });
  }
};

// Get suppliers
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      supplierType: req.query.supplierType ? (req.query.supplierType as string).split(',') as SupplierType[] : undefined,
      ratingMin: req.query.ratingMin ? parseFloat(req.query.ratingMin as string) : undefined,
      location: req.query.location as string,
      search: req.query.search as string
    };

    const result = await supplier.getSuppliers(filters);

    res.json({
      success: true,
      data: result.suppliers,
      meta: {
        total: result.total,
        count: result.suppliers.length,
        filters
      }
    });

  } catch (error) {
    logger.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve suppliers'
    });
  }
};

// Get goods receipts by purchase order
export const getGoodsReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { purchaseOrderId } = req.params;

    const receipts = await goodsReceipt.getByPurchaseOrder(purchaseOrderId);

    res.json({
      success: true,
      data: receipts,
      meta: {
        count: receipts.length,
        purchaseOrderId
      }
    });

  } catch (error) {
    logger.error('Get goods receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve goods receipts'
    });
  }
};

// Complete quality check
export const completeQualityCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiptId } = req.params;
    const { status, notes } = req.body;

    if (!status || !Object.values(QualityCheckStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Valid quality check status is required'
      });
      return;
    }

    const receipt = await goodsReceipt.completeQualityCheck(
      receiptId,
      req.user?.id || 'system',
      status,
      notes
    );

    res.json({
      success: true,
      message: 'Quality check completed',
      data: receipt
    });

  } catch (error) {
    logger.error('Complete quality check error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete quality check'
    });
  }
};

// Cancel purchase order
export const cancelPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
      return;
    }

    const order = await purchaseOrder.cancel(
      orderId,
      req.user?.id || 'system',
      reason
    );

    res.json({
      success: true,
      message: 'Purchase order cancelled',
      data: order
    });

  } catch (error) {
    logger.error('Cancel purchase order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel purchase order'
    });
  }
};