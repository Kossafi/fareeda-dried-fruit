import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocket } from '@contexts/SocketContext';
import {
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StockLevel, Product, ProductUnit, StockMovementType } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import StockAdjustmentModal from '@components/stock/StockAdjustmentModal';
import toast from 'react-hot-toast';
import apiClient from '@services/api';

interface StockLevelWithMovements extends StockLevel {
  recentMovements?: any[];
}

const StockPage: React.FC = () => {
  const { user } = useAuth();
  const { connected, subscribeToStockUpdates, onStockLevelUpdate, onLowStockAlert } = useSocket();
  const [stockLevels, setStockLevels] = useState<StockLevelWithMovements[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockLevelWithMovements[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out'>('all');
  const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  useEffect(() => {
    loadStockLevels();
    
    // Subscribe to real-time stock updates
    if (connected) {
      stockLevels.forEach(stock => {
        subscribeToStockUpdates(stock.productId);
      });
    }

    // Listen for stock level updates
    const unsubscribeStockUpdate = onStockLevelUpdate((data) => {
      setStockLevels(prev => 
        prev.map(stock => 
          stock.productId === data.productId && stock.branchId === data.branchId
            ? { ...stock, quantity: data.quantity }
            : stock
        )
      );
    });

    // Listen for low stock alerts
    const unsubscribeLowStock = onLowStockAlert((data) => {
      toast.error(`สินค้าใกล้หมด: ${data.productId}`, {
        duration: 6000,
        icon: '⚠️',
      });
    });

    return () => {
      unsubscribeStockUpdate();
      unsubscribeLowStock();
    };
  }, [connected]);

  useEffect(() => {
    // Filter stock based on search query and filter type
    let filtered = stockLevels;

    // Search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(stock => 
        stock.product.name.toLowerCase().includes(query) ||
        stock.product.sku.toLowerCase().includes(query)
      );
    }

    // Type filter
    switch (filterType) {
      case 'low':
        filtered = filtered.filter(stock => 
          stock.quantity > 0 && stock.quantity <= stock.threshold
        );
        break;
      case 'out':
        filtered = filtered.filter(stock => stock.quantity === 0);
        break;
      default:
        // Show all
        break;
    }

    setFilteredStock(filtered);
  }, [stockLevels, searchQuery, filterType]);

  const loadStockLevels = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API call
      const mockStockLevels: StockLevelWithMovements[] = [
        {
          id: '1',
          productId: '1',
          product: {
            id: '1',
            name: 'อัลมอนด์อ่อน',
            sku: 'ALM001',
            description: 'อัลมอนด์อ่อนคุณภาพดี',
            unit: ProductUnit.GRAM,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          branchId: user?.branchId || '1',
          branch: user?.branch || { id: '1', name: 'สาขาหลัก', location: 'ชั้น 1', isActive: true, createdAt: '', updatedAt: '' },
          quantity: 2500,
          threshold: 1000,
          lastUpdated: new Date().toISOString(),
          recentMovements: [
            { type: StockMovementType.OUT, quantity: 250, createdAt: '2 ชั่วโมงที่แล้ว' },
            { type: StockMovementType.IN, quantity: 5000, createdAt: 'เมื่อวาน' }
          ]
        },
        {
          id: '2',
          productId: '2',
          product: {
            id: '2',
            name: 'ลูกเกดอ่อน',
            sku: 'RSN001',
            description: 'ลูกเกดอ่อนไร้เม็ด',
            unit: ProductUnit.GRAM,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          branchId: user?.branchId || '1',
          branch: user?.branch || { id: '1', name: 'สาขาหลัก', location: 'ชั้น 1', isActive: true, createdAt: '', updatedAt: '' },
          quantity: 800,
          threshold: 1000,
          lastUpdated: new Date().toISOString(),
          recentMovements: [
            { type: StockMovementType.OUT, quantity: 150, createdAt: '1 ชั่วโมงที่แล้ว' }
          ]
        },
        {
          id: '3',
          productId: '3',
          product: {
            id: '3',
            name: 'มะม่วงอ่อน',
            sku: 'PPY001',
            description: 'มะม่วงอ่อนหวาน',
            unit: ProductUnit.GRAM,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          branchId: user?.branchId || '1',
          branch: user?.branch || { id: '1', name: 'สาขาหลัก', location: 'ชั้น 1', isActive: true, createdAt: '', updatedAt: '' },
          quantity: 0,
          threshold: 500,
          lastUpdated: new Date().toISOString(),
          recentMovements: [
            { type: StockMovementType.OUT, quantity: 300, createdAt: '3 ชั่วโมงที่แล้ว' }
          ]
        },
        {
          id: '4',
          productId: '6',
          product: {
            id: '6',
            name: 'มะที่นับชิ้น',
            sku: 'DTP001',
            description: 'มะที่อบแห้งบรรจุถุง',
            unit: ProductUnit.PIECE,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          branchId: user?.branchId || '1',
          branch: user?.branch || { id: '1', name: 'สาขาหลัก', location: 'ชั้น 1', isActive: true, createdAt: '', updatedAt: '' },
          quantity: 45,
          threshold: 20,
          lastUpdated: new Date().toISOString(),
          recentMovements: [
            { type: StockMovementType.OUT, quantity: 5, createdAt: '30 นาทีที่แล้ว' }
          ]
        }
      ];
      
      setStockLevels(mockStockLevels);
      setFilteredStock(mockStockLevels);
    } catch (error) {
      console.error('Failed to load stock levels:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสต๊อคได้');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stock: StockLevel) => {
    if (stock.quantity === 0) {
      return { status: 'out', label: 'หมดสต๊อค', color: 'text-danger-600 bg-danger-100' };
    } else if (stock.quantity <= stock.threshold) {
      return { status: 'low', label: 'ใกล้หมด', color: 'text-warning-600 bg-warning-100' };
    } else {
      return { status: 'normal', label: 'ปกติ', color: 'text-success-600 bg-success-100' };
    }
  };

  const getUnitDisplay = (unit: ProductUnit) => {
    switch (unit) {
      case ProductUnit.GRAM:
        return 'กรัม';
      case ProductUnit.KILOGRAM:
        return 'กิโลกรัม';
      case ProductUnit.PIECE:
        return 'ชิ้น';
      case ProductUnit.PACKAGE:
        return 'แพ็ค';
      default:
        return unit;
    }
  };

  const handleStockAdjustment = (stock: StockLevel) => {
    setSelectedStock(stock);
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (adjustment: { quantity: number; type: 'increase' | 'decrease'; notes: string }) => {
    if (!selectedStock) return;

    try {
      // Calculate new quantity
      const newQuantity = adjustment.type === 'increase' 
        ? selectedStock.quantity + adjustment.quantity
        : Math.max(0, selectedStock.quantity - adjustment.quantity);

      // Update local state immediately for better UX
      setStockLevels(prev => 
        prev.map(stock => 
          stock.id === selectedStock.id
            ? { ...stock, quantity: newQuantity, lastUpdated: new Date().toISOString() }
            : stock
        )
      );

      toast.success(`ปรับปรุงสต๊อคสำเร็จ! ${selectedStock.product.name}`);
      
      setShowAdjustmentModal(false);
      setSelectedStock(null);
    } catch (error) {
      console.error('Stock adjustment error:', error);
      toast.error('เกิดข้อผิดพลาดในการปรับปรุงสต๊อค');
    }
  };

  const lowStockCount = stockLevels.filter(stock => 
    stock.quantity > 0 && stock.quantity <= stock.threshold
  ).length;
  
  const outOfStockCount = stockLevels.filter(stock => stock.quantity === 0).length;
  
  const totalStockValue = stockLevels.reduce((total, stock) => total + stock.quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" message="กำลังโหลดข้อมูลสต๊อค..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <CubeIcon className="h-8 w-8 mr-3 text-primary-600" />
            จัดการสต๊อคสินค้า (Manual Weight)
          </h1>
          <p className="text-gray-600 mt-1">
            จัดการสต๊อคตามน้ำหนัก/จำนวนคงเหลือในสาขา
          </p>
        </div>
        
        <div className="text-right text-sm text-gray-600">
          {user?.branch && (
            <div>
              <p className="font-medium">{user.branch.name}</p>
              <p className="flex items-center justify-end">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  connected ? 'bg-success-500' : 'bg-danger-500'
                }`} />
                {connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <CubeIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">สินค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{stockLevels.length}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">ใกล้หมด</p>
                <p className="text-2xl font-bold text-warning-600">{lowStockCount}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
                  <XMarkIcon className="w-5 h-5 text-danger-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">หมดสต๊อค</p>
                <p className="text-2xl font-bold text-danger-600">{outOfStockCount}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CubeIcon className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">รวมสต๊อค</p>
                <p className="text-2xl font-bold text-gray-900">{totalStockValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">กรัม/ชิ้น</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="ค้นหาสินค้าด้วยชื่อหรือ SKU..."
                />
              </div>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  filterType === 'all'
                    ? 'bg-primary-100 text-primary-900 border border-primary-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ทั้งหมด ({stockLevels.length})
              </button>
              <button
                onClick={() => setFilterType('low')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  filterType === 'low'
                    ? 'bg-warning-100 text-warning-900 border border-warning-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ใกล้หมด ({lowStockCount})
              </button>
              <button
                onClick={() => setFilterType('out')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  filterType === 'out'
                    ? 'bg-danger-100 text-danger-900 border border-danger-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                หมดสต๊อค ({outOfStockCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stock List */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">รายการสต๊อคสินค้า</h3>
          <p className="text-sm text-gray-500">
            แสดง {filteredStock.length} จาก {stockLevels.length} รายการ
          </p>
        </div>
        <div className="card-body">
          {filteredStock.length > 0 ? (
            <div className="space-y-4">
              {filteredStock.map((stock) => {
                const status = getStockStatus(stock);
                return (
                  <div key={stock.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h4 className="text-lg font-medium text-gray-900 mr-3">
                            {stock.product.name}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>SKU: {stock.product.sku}</span>
                          <span>•</span>
                          <span>หน่วย: {getUnitDisplay(stock.product.unit)}</span>
                          <span>•</span>
                          <span>ระดับแจ้งเตือน: {stock.threshold.toLocaleString()}</span>
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex items-center space-x-4">
                            <div className="text-2xl font-bold text-gray-900">
                              {stock.quantity.toLocaleString()} 
                              <span className="text-base font-normal text-gray-500">
                                {getUnitDisplay(stock.product.unit)}
                              </span>
                            </div>
                            
                            {stock.recentMovements && stock.recentMovements.length > 0 && (
                              <div className="flex items-center text-xs text-gray-500">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                <span>กิจกรรมล่าสุด:</span>
                                {stock.recentMovements.slice(0, 2).map((movement, index) => (
                                  <span key={index} className="ml-2 flex items-center">
                                    {movement.type === StockMovementType.IN ? (
                                      <ArrowUpIcon className="h-3 w-3 text-success-500 mr-1" />
                                    ) : (
                                      <ArrowDownIcon className="h-3 w-3 text-danger-500 mr-1" />
                                    )}
                                    {movement.quantity} ({movement.createdAt})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  status.status === 'out' ? 'bg-danger-500' :
                                  status.status === 'low' ? 'bg-warning-500' :
                                  'bg-success-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, (stock.quantity / (stock.threshold * 2)) * 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>0</span>
                              <span>ระดับแจ้งเตือน: {stock.threshold.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <div className="ml-6">
                        <button
                          onClick={() => handleStockAdjustment(stock)}
                          className="btn btn-outline flex items-center"
                        >
                          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
                          ปรับปรุงสต๊อค
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {searchQuery.trim() !== '' 
                  ? 'ไม่พบสินค้าที่ตรงกับคำค้นหา'
                  : 'ไม่มีสินค้าในหมวดหมู่นี้'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && selectedStock && (
        <StockAdjustmentModal
          stock={selectedStock}
          onSubmit={handleAdjustmentSubmit}
          onClose={() => {
            setShowAdjustmentModal(false);
            setSelectedStock(null);
          }}
        />
      )}
    </div>
  );
};

export default StockPage;