import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  QrCodeIcon,
  CubeIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Product, ProductUnit } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import apiClient from '@services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ProductSearchModalProps {
  onProductSelect: (product: Product) => void;
  onClose: () => void;
}

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ onProductSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on search input when modal opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    
    // Load initial products
    loadProducts();
  }, []);

  useEffect(() => {
    // Filter products based on search query
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query))
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API call
      const mockProducts: Product[] = [
        {
          id: '1',
          name: 'อัลมอนด์อ่อน',
          sku: 'ALM001',
          description: 'อัลมอนด์อ่อนคุณภาพดี',
          unit: ProductUnit.GRAM,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'ลูกเกดอ่อน',
          sku: 'RSN001',
          description: 'ลูกเกดอ่อนไร้เม็ด',
          unit: ProductUnit.GRAM,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '3',
          name: 'มะม่วงอ่อน',
          sku: 'PPY001',
          description: 'มะม่วงอ่อนหวาน',
          unit: ProductUnit.GRAM,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '4',
          name: 'ผลไม้อบแห้งเชื้อม',
          sku: 'DFM001',
          description: 'ผลไม้รวมอบแห้งเชื้อม',
          unit: ProductUnit.GRAM,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '5',
          name: 'องุ่นอ่อน',
          sku: 'GRP001',
          description: 'องุ่นอ่อนไร้เม็ด',
          unit: ProductUnit.GRAM,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '6',
          name: 'มะที่นับชิ้น',
          sku: 'DTP001',
          description: 'มะที่อบแห้งบรรจุถุง',
          unit: ProductUnit.PIECE,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      setProducts(mockProducts);
      setFilteredProducts(mockProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanner = () => {
    setShowBarcodeScanner(true);
    toast.info('ตัวสแกนบาร์โค้ดจะเปิดในเวอร์ชั่นต่อไป');
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

  const getUnitIcon = (unit: ProductUnit) => {
    if (unit === ProductUnit.PIECE || unit === ProductUnit.PACKAGE) {
      return '📦'; // Package emoji
    }
    return '⚖️'; // Scale emoji
  };

  return (
    <Transition show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <CubeIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      เลือกสินค้า
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                      placeholder="ค้นหาด้วยชื่อสินค้า, SKU หรือคำอธิบาย..."
                      autoComplete="off"
                    />
                  </div>
                  
                  {/* Barcode Scanner Button */}
                  <button
                    onClick={handleBarcodeScanner}
                    className="mt-3 w-full flex items-center justify-center p-3 border border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors duration-200 group"
                  >
                    <QrCodeIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary-900">
                      สแกนบาร์โค้ดสินค้า
                    </span>
                  </button>
                </div>

                {/* Search Results */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">
                      ผลการค้นหา
                    </h3>
                    <span className="text-xs text-gray-500">
                      พบ {filteredProducts.length} รายการ
                    </span>
                  </div>
                  
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner size="medium" message="กำลังโหลดสินค้า..." />
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => onProductSelect(product)}
                          className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-1">
                                <span className="text-lg mr-2">{getUnitIcon(product.unit)}</span>
                                <h4 className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                                  {product.name}
                                </h4>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">
                                SKU: {product.sku} • หน่วย: {getUnitDisplay(product.unit)}
                              </p>
                              {product.description && (
                                <p className="text-xs text-gray-400">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <div className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200',
                                'bg-gray-100 group-hover:bg-primary-100'
                              )}>
                                <CheckIcon className="h-4 w-4 text-gray-400 group-hover:text-primary-600" />
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {searchQuery.trim() === '' 
                          ? 'กรอกคำค้นหาเพื่อค้นหาสินค้า'
                          : 'ไม่พบสินค้าที่ตรงกับคำค้นหา'
                        }
                      </p>
                      {searchQuery.trim() !== '' && (
                        <p className="text-xs text-gray-400 mt-1">
                          ลองค้นหาด้วยคำอื่นหรือสแกนบาร์โค้ด
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="btn btn-outline"
                  >
                    ยกเลิก
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ProductSearchModal;