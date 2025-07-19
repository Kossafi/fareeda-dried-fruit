import { Request, Response } from 'express';
import Joi from 'joi';
import DriverModel from '../models/Driver';
import { DriverStatus } from '@dried-fruits/types';
import logger from '../utils/logger';

const driverModel = new DriverModel();

// Validation schemas
const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(DriverStatus)).required(),
});

const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  speed: Joi.number().min(0).optional(),
  heading: Joi.number().min(0).max(360).optional(),
  accuracy: Joi.number().min(0).optional(),
});

export const getDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    const driver = await driverModel.findById(driverId);

    if (!driver) {
      res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
      return;
    }

    res.json({
      success: true,
      data: driver,
    });

  } catch (error) {
    logger.error('Get driver API error', {
      error: error.message,
      driverId: req.params.driverId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver',
    });
  }
};

export const getAvailableDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await driverModel.findAvailableDrivers();

    res.json({
      success: true,
      data: drivers,
      meta: {
        count: drivers.length,
      },
    });

  } catch (error) {
    logger.error('Get available drivers API error', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available drivers',
    });
  }
};

export const updateDriverStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { error, value } = updateStatusSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    const updatedDriver = await driverModel.updateStatus(driverId, value.status);

    logger.info('Driver status updated via API', {
      driverId,
      newStatus: value.status,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Driver status updated successfully',
      data: updatedDriver,
    });

  } catch (error) {
    logger.error('Update driver status API error', {
      error: error.message,
      driverId: req.params.driverId,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update driver status',
    });
  }
};

export const updateDriverLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { error, value } = updateLocationSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    await driverModel.updateLocation(driverId, value);

    logger.debug('Driver location updated', {
      driverId,
      location: value,
    });

    res.json({
      success: true,
      message: 'Driver location updated successfully',
    });

  } catch (error) {
    logger.error('Update driver location API error', {
      error: error.message,
      driverId: req.params.driverId,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update driver location',
    });
  }
};

export const getDriverLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    const location = await driverModel.getCurrentLocation(driverId);

    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Driver location not found',
      });
      return;
    }

    res.json({
      success: true,
      data: location,
    });

  } catch (error) {
    logger.error('Get driver location API error', {
      error: error.message,
      driverId: req.params.driverId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver location',
    });
  }
};

export const getDriverDeliveryHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
    const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

    const history = await driverModel.getDeliveryHistory(
      driverId,
      parsedStartDate,
      parsedEndDate,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: history,
      meta: {
        driverId,
        dateRange: {
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        },
        limit: parseInt(limit as string),
      },
    });

  } catch (error) {
    logger.error('Get driver delivery history API error', {
      error: error.message,
      driverId: req.params.driverId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver delivery history',
    });
  }
};