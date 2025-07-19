import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const PurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" message="กำลังโหลดใบสั่งซื้อ..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 mr-3 text-primary-600" />
            จัดการใบสั่งซื้อ
          </h1>
          <p className="text-gray-600 mt-1">
            สร้างและจัดการใบสั่งซื้อสินค้าจากคลังสินค้า
          </p>
        </div>
        
        <button
          onClick={() => toast.success('ฟีเจอร์นี้กำลังพัฒนา')}
          className="btn btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          สร้างใบสั่งซื้อ
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10"
                  placeholder="ค้นหาใบสั่งซื้อ..."
                />
              </div>
            </div>
            
            <button className="btn btn-outline flex items-center">
              <FunnelIcon className="h-4 w-4 mr-2" />
              ตัวกรอง
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">รายการใบสั่งซื้อ</h3>
        </div>
        <div className="card-body">
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              ยังไม่มีใบสั่งซื้อ
            </p>
            <p className="text-xs text-gray-400 mt-1">
              ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrdersPage;