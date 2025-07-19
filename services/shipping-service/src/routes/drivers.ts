import express from 'express';
import * as driverController from '../controllers/driverController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Driver routes
router.get('/available', driverController.getAvailableDrivers);
router.get('/location/:driverId', driverController.getDriverLocation);
router.get('/:driverId', driverController.getDriver);
router.get('/:driverId/history', driverController.getDriverDeliveryHistory);
router.put('/:driverId/status', driverController.updateDriverStatus);
router.put('/:driverId/location', driverController.updateDriverLocation);

export default router;