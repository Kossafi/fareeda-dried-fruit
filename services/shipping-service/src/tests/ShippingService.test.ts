import { ShippingService } from '../services/ShippingService';
import { DeliveryOrderModel } from '../models/DeliveryOrder';
import { DeliveryOrderItemModel } from '../models/DeliveryOrderItem';
import { DeliveryTrackingModel } from '../models/DeliveryTracking';
import { DriverModel } from '../models/Driver';
import { 
  DeliveryType, 
  DeliveryStatus, 
  DriverStatus,
  TrackingEventType 
} from '@dried-fruits/types';

// Mock the database connection and models
jest.mock('../database/connection');
jest.mock('../models/DeliveryOrder');
jest.mock('../models/DeliveryOrderItem');
jest.mock('../models/DeliveryTracking');
jest.mock('../models/Driver');

describe('ShippingService', () => {
  let shippingService: ShippingService;
  let mockDeliveryOrderModel: jest.Mocked<DeliveryOrderModel>;
  let mockDeliveryOrderItemModel: jest.Mocked<DeliveryOrderItemModel>;
  let mockDeliveryTrackingModel: jest.Mocked<DeliveryTrackingModel>;
  let mockDriverModel: jest.Mocked<DriverModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    shippingService = new ShippingService();
    
    mockDeliveryOrderModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOrderNumber: jest.fn(),
      findByStatus: jest.fn(),
      findByBranch: jest.fn(),
      findByDriver: jest.fn(),
      updateStatus: jest.fn(),
      assignDriver: jest.fn(),
      getOrdersRequiringAttention: jest.fn(),
      getDeliveryAnalytics: jest.fn(),
    } as any;

    mockDeliveryOrderItemModel = {
      create: jest.fn(),
      findByDeliveryOrder: jest.fn(),
      findById: jest.fn(),
      confirmItem: jest.fn(),
      confirmMultipleItems: jest.fn(),
      bulkCreate: jest.fn(),
      findItemsRequiringConfirmation: jest.fn(),
      getDeliveryOrderSummary: jest.fn(),
      findItemsByProduct: jest.fn(),
      deleteItem: jest.fn(),
      deleteItemsByDeliveryOrder: jest.fn(),
    } as any;

    mockDeliveryTrackingModel = {
      create: jest.fn(),
      findByDeliveryOrder: jest.fn(),
      findLatestByDeliveryOrder: jest.fn(),
      findByEventType: jest.fn(),
      findByDriver: jest.fn(),
      getDeliveryTimeline: jest.fn(),
      bulkCreate: jest.fn(),
      getLocationHistory: jest.fn(),
      getEventStatistics: jest.fn(),
      findRecentActivity: jest.fn(),
    } as any;

    mockDriverModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeId: jest.fn(),
      findByStatus: jest.fn(),
      findAvailableDrivers: jest.fn(),
      updateStatus: jest.fn(),
      updateLocation: jest.fn(),
      getDriverPerformance: jest.fn(),
      getDriverCurrentAssignment: jest.fn(),
      findDriversWithExpiredLicenses: jest.fn(),
      updateDriver: jest.fn(),
      getAllDrivers: jest.fn(),
      deactivateDriver: jest.fn(),
    } as any;

    // Replace the models in the service
    (shippingService as any).deliveryOrderModel = mockDeliveryOrderModel;
    (shippingService as any).deliveryOrderItemModel = mockDeliveryOrderItemModel;
    (shippingService as any).deliveryTrackingModel = mockDeliveryTrackingModel;
    (shippingService as any).driverModel = mockDriverModel;

    // Mock database
    const mockDb = require('../database/connection').default.getInstance();
    mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
      return callback({});
    });
    mockDb.publishEvent = jest.fn();
  });

  describe('createDeliveryOrder', () => {
    const validOrderData = {
      fromBranchId: 'branch-1',
      toBranchId: 'branch-2',
      deliveryType: DeliveryType.COMPANY_VEHICLE,
      scheduledPickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      scheduledDeliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      items: [
        {
          inventoryItemId: 'item-1',
          quantity: 10,
        },
        {
          inventoryItemId: 'item-2',
          quantity: 20,
        },
      ],
      specialInstructions: 'Handle with care',
      requiresSignature: true,
      requiresRefrigeration: false,
      contactPersonName: 'John Doe',
      contactPhone: '+1234567890',
    };

    const mockDeliveryOrder = {
      id: 'delivery-123',
      orderNumber: 'DEL-20240120-0001',
      fromBranchId: 'branch-1',
      toBranchId: 'branch-2',
      status: DeliveryStatus.PENDING,
      deliveryType: DeliveryType.COMPANY_VEHICLE,
      scheduledPickupDate: new Date(validOrderData.scheduledPickupDate),
      scheduledDeliveryDate: new Date(validOrderData.scheduledDeliveryDate),
      totalItems: 0,
      totalWeight: 0,
      totalValue: 0,
      requiresSignature: true,
      requiresRefrigeration: false,
      specialInstructions: 'Handle with care',
      contactPersonName: 'John Doe',
      contactPhone: '+1234567890',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
    };

    const mockOrderItems = [
      {
        id: 'item-1',
        deliveryOrderId: 'delivery-123',
        inventoryItemId: 'item-1',
        productId: 'product-1',
        productName: 'Dried Mango',
        quantity: 10,
        unit: 'kilogram',
        weight: 10,
        value: 100,
        confirmed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item-2',
        deliveryOrderId: 'delivery-123',
        inventoryItemId: 'item-2',
        productId: 'product-2',
        productName: 'Dried Pineapple',
        quantity: 20,
        unit: 'kilogram',
        weight: 20,
        value: 200,
        confirmed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should create delivery order successfully', async () => {
      // Mock inventory item validation
      (shippingService as any).validateAndPrepareItems = jest.fn().mockResolvedValue([
        {
          deliveryOrderId: 'delivery-123',
          inventoryItemId: 'item-1',
          productId: 'product-1',
          productName: 'Dried Mango',
          quantity: 10,
          unit: 'kilogram',
          weight: 10,
          value: 100,
        },
        {
          deliveryOrderId: 'delivery-123',
          inventoryItemId: 'item-2',
          productId: 'product-2',
          productName: 'Dried Pineapple',
          quantity: 20,
          unit: 'kilogram',
          weight: 20,
          value: 200,
        },
      ]);

      (shippingService as any).reserveInventoryItems = jest.fn().mockResolvedValue(undefined);

      mockDeliveryOrderModel.create.mockResolvedValue(mockDeliveryOrder as any);
      mockDeliveryOrderItemModel.bulkCreate.mockResolvedValue(mockOrderItems as any);
      mockDeliveryTrackingModel.create.mockResolvedValue({} as any);

      const result = await shippingService.createDeliveryOrder(validOrderData, 'user-123');

      expect(mockDeliveryOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBranchId: 'branch-1',
          toBranchId: 'branch-2',
          deliveryType: DeliveryType.COMPANY_VEHICLE,
          specialInstructions: 'Handle with care',
          requiresSignature: true,
          requiresRefrigeration: false,
          contactPersonName: 'John Doe',
          contactPhone: '+1234567890',
          createdBy: 'user-123',
        })
      );

      expect(mockDeliveryOrderItemModel.bulkCreate).toHaveBeenCalled();
      expect(mockDeliveryTrackingModel.create).toHaveBeenCalledWith({
        deliveryOrderId: 'delivery-123',
        eventType: TrackingEventType.ORDER_CREATED,
        status: DeliveryStatus.PENDING,
        description: 'Delivery order created and pending driver assignment',
        performedBy: 'user-123',
      });

      expect(result.deliveryOrder).toEqual(mockDeliveryOrder);
      expect(result.items).toEqual(mockOrderItems);
    });

    it('should throw error for same source and destination branches', async () => {
      const invalidData = {
        ...validOrderData,
        toBranchId: 'branch-1', // Same as fromBranchId
      };

      await expect(shippingService.createDeliveryOrder(invalidData, 'user-123'))
        .rejects.toThrow('Source and destination branches cannot be the same');
    });

    it('should throw error for empty items array', async () => {
      const invalidData = {
        ...validOrderData,
        items: [],
      };

      await expect(shippingService.createDeliveryOrder(invalidData, 'user-123'))
        .rejects.toThrow('At least one item is required');
    });

    it('should throw error for past pickup date', async () => {
      const invalidData = {
        ...validOrderData,
        scheduledPickupDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      };

      await expect(shippingService.createDeliveryOrder(invalidData, 'user-123'))
        .rejects.toThrow('Pickup date must be in the future');
    });

    it('should throw error for delivery date before pickup date', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const invalidData = {
        ...validOrderData,
        scheduledPickupDate: tomorrow,
        scheduledDeliveryDate: tomorrow, // Same as pickup date
      };

      await expect(shippingService.createDeliveryOrder(invalidData, 'user-123'))
        .rejects.toThrow('Delivery date must be after pickup date');
    });
  });

  describe('assignDriver', () => {
    const mockDriver = {
      id: 'driver-123',
      userId: 'user-456',
      employeeId: 'EMP001',
      licenseNumber: 'DL123456',
      licenseExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // One year from now
      status: DriverStatus.AVAILABLE,
      isActive: true,
      phoneNumber: '+1234567890',
      emergencyContact: {
        name: 'Jane Doe',
        phone: '+0987654321',
        relationship: 'Spouse',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const assignmentData = {
      driverId: 'driver-123',
      vehicleId: 'vehicle-456',
      notes: 'Urgent delivery',
    };

    it('should assign driver successfully', async () => {
      const mockUpdatedOrder = {
        id: 'delivery-123',
        status: DeliveryStatus.ASSIGNED,
        driverId: 'driver-123',
        vehicleId: 'vehicle-456',
      };

      mockDriverModel.findById.mockResolvedValue(mockDriver as any);
      (shippingService as any).validateVehicleAvailability = jest.fn().mockResolvedValue(undefined);
      mockDeliveryOrderModel.assignDriver.mockResolvedValue(mockUpdatedOrder as any);
      mockDeliveryTrackingModel.create.mockResolvedValue({} as any);

      const result = await shippingService.assignDriver(
        'delivery-123',
        assignmentData,
        'user-789'
      );

      expect(mockDriverModel.findById).toHaveBeenCalledWith('driver-123');
      expect(mockDeliveryOrderModel.assignDriver).toHaveBeenCalledWith(
        'delivery-123',
        'driver-123',
        'vehicle-456',
        'user-789'
      );
      expect(mockDeliveryTrackingModel.create).toHaveBeenCalledWith({
        deliveryOrderId: 'delivery-123',
        eventType: TrackingEventType.DRIVER_ASSIGNED,
        status: DeliveryStatus.ASSIGNED,
        description: `Driver ${mockDriver.employeeId} assigned to delivery`,
        performedBy: 'user-789',
        metadata: {
          driverId: 'driver-123',
          vehicleId: 'vehicle-456',
          notes: 'Urgent delivery',
        },
      });

      expect(result).toEqual(mockUpdatedOrder);
    });

    it('should throw error for non-existent driver', async () => {
      mockDriverModel.findById.mockResolvedValue(null);

      await expect(shippingService.assignDriver('delivery-123', assignmentData, 'user-789'))
        .rejects.toThrow('Driver not found');
    });

    it('should throw error for inactive driver', async () => {
      const inactiveDriver = { ...mockDriver, isActive: false };
      mockDriverModel.findById.mockResolvedValue(inactiveDriver as any);

      await expect(shippingService.assignDriver('delivery-123', assignmentData, 'user-789'))
        .rejects.toThrow('Driver is not active');
    });

    it('should throw error for unavailable driver', async () => {
      const busyDriver = { ...mockDriver, status: DriverStatus.IN_TRANSIT };
      mockDriverModel.findById.mockResolvedValue(busyDriver as any);

      await expect(shippingService.assignDriver('delivery-123', assignmentData, 'user-789'))
        .rejects.toThrow('Driver is not available');
    });

    it('should throw error for expired license', async () => {
      const expiredLicenseDriver = {
        ...mockDriver,
        licenseExpirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };
      mockDriverModel.findById.mockResolvedValue(expiredLicenseDriver as any);

      await expect(shippingService.assignDriver('delivery-123', assignmentData, 'user-789'))
        .rejects.toThrow('Driver license has expired');
    });
  });

  describe('updateDeliveryStatus', () => {
    const mockDeliveryOrder = {
      id: 'delivery-123',
      orderNumber: 'DEL-20240120-0001',
      status: DeliveryStatus.ASSIGNED,
      driverId: 'driver-123',
    };

    const statusUpdate = {
      status: DeliveryStatus.IN_TRANSIT,
      location: 'Highway 101',
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
      notes: 'On the way to destination',
      actualTime: new Date().toISOString(),
    };

    it('should update delivery status successfully', async () => {
      const mockUpdatedOrder = {
        ...mockDeliveryOrder,
        status: DeliveryStatus.IN_TRANSIT,
      };

      const mockTrackingEvent = {
        id: 'tracking-123',
        deliveryOrderId: 'delivery-123',
        eventType: TrackingEventType.IN_TRANSIT,
        status: DeliveryStatus.IN_TRANSIT,
        location: 'Highway 101',
        coordinates: statusUpdate.coordinates,
        description: 'On the way to destination',
        timestamp: new Date(statusUpdate.actualTime),
      };

      mockDeliveryOrderModel.findById.mockResolvedValue(mockDeliveryOrder as any);
      mockDeliveryOrderModel.updateStatus.mockResolvedValue(mockUpdatedOrder as any);
      mockDeliveryTrackingModel.create.mockResolvedValue(mockTrackingEvent as any);
      (shippingService as any).updateDriverStatusBasedOnDelivery = jest.fn().mockResolvedValue(undefined);

      const result = await shippingService.updateDeliveryStatus(
        'delivery-123',
        statusUpdate,
        'user-456'
      );

      expect(mockDeliveryOrderModel.findById).toHaveBeenCalledWith('delivery-123');
      expect(mockDeliveryOrderModel.updateStatus).toHaveBeenCalledWith(
        'delivery-123',
        DeliveryStatus.IN_TRANSIT,
        { actualPickupTime: new Date(statusUpdate.actualTime) }
      );
      expect(mockDeliveryTrackingModel.create).toHaveBeenCalledWith({
        deliveryOrderId: 'delivery-123',
        eventType: TrackingEventType.IN_TRANSIT,
        status: DeliveryStatus.IN_TRANSIT,
        location: 'Highway 101',
        coordinates: statusUpdate.coordinates,
        description: 'On the way to destination',
        performedBy: 'user-456',
        timestamp: new Date(statusUpdate.actualTime),
      });

      expect(result.deliveryOrder).toEqual(mockUpdatedOrder);
      expect(result.tracking).toEqual(mockTrackingEvent);
    });

    it('should throw error for non-existent delivery order', async () => {
      mockDeliveryOrderModel.findById.mockResolvedValue(null);

      await expect(shippingService.updateDeliveryStatus('non-existent', statusUpdate, 'user-456'))
        .rejects.toThrow('Delivery order not found');
    });

    it('should validate status transitions', async () => {
      const completedOrder = {
        ...mockDeliveryOrder,
        status: DeliveryStatus.DELIVERED,
      };

      mockDeliveryOrderModel.findById.mockResolvedValue(completedOrder as any);

      const invalidStatusUpdate = {
        ...statusUpdate,
        status: DeliveryStatus.ASSIGNED, // Cannot go back to assigned from delivered
      };

      await expect(shippingService.updateDeliveryStatus('delivery-123', invalidStatusUpdate, 'user-456'))
        .rejects.toThrow('Invalid status transition');
    });
  });

  describe('confirmDelivery', () => {
    const mockDeliveryOrder = {
      id: 'delivery-123',
      orderNumber: 'DEL-20240120-0001',
      status: DeliveryStatus.DELIVERED,
      toBranchId: 'branch-2',
      driverId: 'driver-123',
    };

    const confirmationData = {
      items: [
        {
          deliveryOrderItemId: 'item-1',
          actualQuantity: 9.5,
          barcodeScanned: true,
          notes: 'Minor weight loss',
        },
        {
          deliveryOrderItemId: 'item-2',
          actualQuantity: 20,
          barcodeScanned: true,
        },
      ],
      receivedBy: 'Branch Manager',
      signatureData: 'base64-signature-data',
      photoProof: 'base64-photo-data',
      notes: 'All items received in good condition',
    };

    it('should confirm delivery successfully', async () => {
      const mockConfirmedItems = [
        {
          id: 'item-1',
          confirmed: true,
          actualQuantity: 9.5,
          notes: 'Minor weight loss',
        },
        {
          id: 'item-2',
          confirmed: true,
          actualQuantity: 20,
        },
      ];

      const mockUpdatedOrder = {
        ...mockDeliveryOrder,
        receivedBy: 'Branch Manager',
        signatureData: 'base64-signature-data',
        photoProof: 'base64-photo-data',
        deliveryNotes: 'All items received in good condition',
      };

      mockDeliveryOrderModel.findById.mockResolvedValue(mockDeliveryOrder as any);
      mockDeliveryOrderItemModel.confirmMultipleItems.mockResolvedValue(mockConfirmedItems as any);
      mockDeliveryOrderModel.updateStatus.mockResolvedValue(mockUpdatedOrder as any);
      mockDeliveryTrackingModel.create.mockResolvedValue({} as any);
      mockDriverModel.updateStatus.mockResolvedValue({} as any);
      (shippingService as any).transferInventoryToBranch = jest.fn().mockResolvedValue(undefined);

      const result = await shippingService.confirmDelivery(
        'delivery-123',
        confirmationData,
        'user-789'
      );

      expect(mockDeliveryOrderModel.findById).toHaveBeenCalledWith('delivery-123');
      expect(mockDeliveryOrderItemModel.confirmMultipleItems).toHaveBeenCalledWith(
        confirmationData.items
      );
      expect(mockDeliveryOrderModel.updateStatus).toHaveBeenCalledWith(
        'delivery-123',
        DeliveryStatus.DELIVERED,
        {
          receivedBy: 'Branch Manager',
          signatureData: 'base64-signature-data',
          photoProof: 'base64-photo-data',
          deliveryNotes: 'All items received in good condition',
        }
      );
      expect(mockDriverModel.updateStatus).toHaveBeenCalledWith('driver-123', DriverStatus.AVAILABLE);

      expect(result.deliveryOrder).toEqual(mockUpdatedOrder);
      expect(result.confirmedItems).toEqual(mockConfirmedItems);
    });

    it('should throw error for non-delivered order', async () => {
      const inTransitOrder = {
        ...mockDeliveryOrder,
        status: DeliveryStatus.IN_TRANSIT,
      };

      mockDeliveryOrderModel.findById.mockResolvedValue(inTransitOrder as any);

      await expect(shippingService.confirmDelivery('delivery-123', confirmationData, 'user-789'))
        .rejects.toThrow('Delivery order must be in delivered status to confirm');
    });
  });
});