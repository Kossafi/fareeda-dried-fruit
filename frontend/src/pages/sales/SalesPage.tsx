import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocket } from '@contexts/SocketContext';
import {
  ShoppingCartIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { SaleItemRequest, SaleRecordRequest, Product, ProductUnit } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import WeightInputModal from '@components/sales/WeightInputModal';
import ProductSearchModal from '@components/sales/ProductSearchModal';
import toast from 'react-hot-toast';
import apiClient from '@services/api';

interface CartItem extends SaleItemRequest {
  id: string;
  product?: Product;
  displayWeight?: string;
}

const SalesPage: React.FC = () => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notes, setNotes] = useState('');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadRecentSales();
    // เล่นเสียงเมื่อเชื่อมต่อ
    if (connected && audioRef.current) {
      audioRef.current.play().catch(() => {/* Ignore autoplay restrictions */});
    }
  }, [connected]);

  const loadRecentSales = async () => {
    try {
      // Mock data - replace with actual API
      setRecentSales([
        {
          id: '1',
          time: '14:30',
          items: 'อัลมอนด์ 250g, ลูกเกด 150g',
          total: '400g'
        },
        {
          id: '2', 
          time: '14:25',
          items: 'มะม่วงอ่อน 300g',
          total: '300g'
        }
      ]);
    } catch (error) {
      console.error('Failed to load recent sales:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setShowProductSearch(false);
    
    if (product.unit === ProductUnit.GRAM || product.unit === ProductUnit.KILOGRAM) {
      // สินค้าชั่งน้ำหนัก - เปิด modal กรอกน้ำหนัก
      setShowWeightModal(true);
    } else {
      // สินค้านับชิ้น - เพิ่มลงตะกร้าเลย (1 ชิ้น)
      addToCart(product, 1, product.unit, '1 ชิ้น');
    }
  };

  const handleWeightInput = (weight: number, unit: ProductUnit) => {
    if (selectedProduct) {
      const displayWeight = unit === ProductUnit.KILOGRAM 
        ? `${weight.toFixed(2)} กก.`
        : `${weight} กรัม`;
      addToCart(selectedProduct, weight, unit, displayWeight);
    }
    setShowWeightModal(false);
    setSelectedProduct(null);
  };

  const addToCart = (product: Product, quantity: number, unit: ProductUnit, displayWeight: string) => {
    const cartItem: CartItem = {
      id: Date.now().toString(),
      productId: product.id,
      quantity,
      unit,
      product,
      displayWeight,
      notes: ''
    };
    
    setCart(prev => [...prev, cartItem]);
    toast.success(`เพิ่ม ${product.name} ${displayWeight} ลงตะกร้าแล้ว`);
    
    // เล่นเสียงแจ้งเตือน
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {/* Ignore */});
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    toast.success('ลบรายการออกจากตะกร้าแล้ว');
  };

  const clearCart = () => {
    setCart([]);
    setNotes('');
    toast.success('ล้างตะกร้าเรียบร้อยแล้ว');
  };

  const calculateTotalItems = () => cart.length;
  
  const calculateTotalWeight = () => {
    return cart.reduce((total, item) => {
      if (item.unit === ProductUnit.KILOGRAM) {
        return total + (item.quantity * 1000); // แปลงกิโลเป็นกรัม
      }
      return total + item.quantity;
    }, 0);
  };

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      toast.error('กรุณาเพิ่มสินค้าลงตะกร้าก่อน');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const saleData: SaleRecordRequest = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes
        })),
        notes
      };

      const response = await apiClient.post('/sales', saleData);
      
      if (response.success) {
        toast.success('บันทึกการขายสำเร็จ!');
        clearCart();
        loadRecentSales();
      } else {
        throw new Error(response.error || 'เกิดข้อผิดพลาดในการบันทึกการขาย');
      }
    } catch (error: any) {
      console.error('Sale submission error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Audio element สำหรับเสียงแจ้งเตือน */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/beep.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ShoppingCartIcon className="h-8 w-8 mr-3 text-primary-600" />
              บันทึกการขาย (Manual Weighing)
            </h1>
            <p className="text-gray-600 mt-1">
              ชั่งน้ำหนักด้วยเครื่องชั่ง แล้วกรอกน้ำหนักลงในระบบ
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              connected 
                ? 'bg-success-100 text-success-800' 
                : 'bg-danger-100 text-danger-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-success-500' : 'bg-danger-500'
              }`} />
              <span>{connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}</span>
            </div>
            
            {/* Branch Info */}
            {user?.branch && (
              <div className="text-right text-sm text-gray-600">
                <p className="font-medium">{user.branch.name}</p>
                <p>พนักงาน: {user.username}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Add Product Buttons */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">เพิ่มสินค้า</h3>
              <p className="text-sm text-gray-500">เลือกวิธีการเพิ่มสินค้าลงตะกร้า</p>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Search Product Button */}
                <button
                  onClick={() => setShowProductSearch(true)}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors duration-200 group"
                >
                  <div className="text-center">
                    <MagnifyingGlassIcon className="h-8 w-8 text-gray-400 group-hover:text-primary-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                      ค้นหาสินค้า
                    </p>
                    <p className="text-xs text-gray-500 group-hover:text-primary-700">
                      ค้นหาด้วยชื่อหรือรหัสสินค้า
                    </p>
                  </div>
                </button>

                {/* Barcode Scanner Button */}
                <button
                  onClick={() => toast.info('ฟีเจอร์สแกนบาร์โค้ดกำลังพัฒนา')}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors duration-200 group"
                >
                  <div className="text-center">
                    <QrCodeIcon className="h-8 w-8 text-gray-400 group-hover:text-primary-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                      สแกนบาร์โค้ด
                    </p>
                    <p className="text-xs text-gray-500 group-hover:text-primary-700">
                      สแกนบาร์โค้ดสินค้า
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">การขายล่าสุด</h3>
              <p className="text-sm text-gray-500">รายการที่ขายไปแล้ววันนี้</p>
            </div>
            <div className="card-body">
              {recentSales.length > 0 ? (
                <div className="space-y-3">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{sale.items}</p>
                          <p className="text-xs text-gray-500">เวลา: {sale.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary-600">{sale.total}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <ShoppingCartIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มีการขายวันนี้</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Shopping Cart */}
        <div className="space-y-6">
          {/* Cart Items */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">ตะกร้าสินค้า</h3>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-sm text-danger-600 hover:text-danger-700 flex items-center"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    ล้างทั้งหมด
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {cart.length} รายการ • รวม {calculateTotalWeight().toLocaleString()} กรัม
              </p>
            </div>
            <div className="card-body">
              {cart.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {item.product?.name || 'ไม่ทราบชื่อสินค้า'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.displayWeight}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-gray-400 italic">{item.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 p-1 text-danger-600 hover:text-danger-700 hover:bg-danger-50 rounded"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCartIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">ตะกร้าว่าง</p>
                  <p className="text-xs text-gray-400">เพิ่มสินค้าเพื่อเริ่มบันทึกการขาย</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">หมายเหตุ</h3>
            </div>
            <div className="card-body">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                className="form-textarea h-20 resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitSale}
            disabled={cart.length === 0 || isSubmitting}
            className="btn btn-primary w-full py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="small" color="white" className="mr-2" />
                กำลังบันทึก...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <CheckIcon className="h-6 w-6 mr-2" />
                บันทึกการขาย ({cart.length} รายการ)
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showWeightModal && selectedProduct && (
        <WeightInputModal
          product={selectedProduct}
          onSubmit={handleWeightInput}
          onClose={() => {
            setShowWeightModal(false);
            setSelectedProduct(null);
          }}
        />
      )}

      {showProductSearch && (
        <ProductSearchModal
          onProductSelect={handleProductSelect}
          onClose={() => setShowProductSearch(false)}
        />
      )}
    </div>
  );
};

export default SalesPage;