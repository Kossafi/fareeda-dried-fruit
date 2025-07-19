import express from 'express';
import * as customerController from '../controllers/customerController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Customer routes
router.post('/', customerController.createCustomer);
router.get('/search', customerController.searchCustomers);
router.get('/top/:branchId', customerController.getTopCustomers);
router.get('/phone/:phone', customerController.findCustomerByPhone);
router.get('/:customerId', customerController.getCustomer);
router.put('/:customerId', customerController.updateCustomer);
router.delete('/:customerId', customerController.deactivateCustomer);
router.get('/:customerId/analytics', customerController.getCustomerAnalytics);

export default router;