import { Router } from 'express';
import {
  createOrderFromAlert,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  getPendingApprovals,
  receiveGoods,
  updateOrderStatus,
  sendToSupplier,
  getPurchaseOrder,
  getPurchaseOrders,
  getSupplierRecommendations,
  getSupplierPerformance,
  getProcurementDashboard,
  createSupplier,
  getSuppliers,
  getGoodsReceipts,
  completeQualityCheck,
  cancelPurchaseOrder
} from '../controllers/procurementController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBranchAccess, requireMultiBranchAccess } from '../middleware/branchValidation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Purchase Order Management
router.post('/create-order', validateBranchAccess, createPurchaseOrder);
router.post('/create-from-alert', createOrderFromAlert);
router.put('/:orderId', validateBranchAccess, updatePurchaseOrder);
router.put('/:orderId/submit', validateBranchAccess, submitForApproval);
router.put('/:orderId/send-to-supplier', authorize(['manager', 'admin']), sendToSupplier);
router.put('/:orderId/status', validateBranchAccess, updateOrderStatus);
router.put('/:orderId/cancel', validateBranchAccess, cancelPurchaseOrder);

// Approval Workflow
router.get('/pending-approval', authorize(['manager', 'supervisor', 'admin']), getPendingApprovals);
router.put('/:orderId/approve', authorize(['manager', 'supervisor', 'admin']), approvePurchaseOrder);

// Purchase Order Queries
router.get('/orders', getPurchaseOrders);
router.get('/orders/:orderId', getPurchaseOrder);
router.get('/dashboard', getProcurementDashboard);

// Goods Receiving
router.post('/receive', validateBranchAccess, receiveGoods);
router.get('/receipts/:purchaseOrderId', getGoodsReceipts);
router.put('/receipts/:receiptId/quality-check', 
  authorize(['manager', 'supervisor', 'quality_control', 'admin']), 
  completeQualityCheck
);

// Supplier Management
router.post('/suppliers', authorize(['manager', 'admin']), createSupplier);
router.get('/suppliers', getSuppliers);
router.get('/suppliers/:supplierId/performance', getSupplierPerformance);
router.get('/recommendations/:productId', getSupplierRecommendations);

export default router;