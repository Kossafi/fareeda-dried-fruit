import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import {
  TruckIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const ReceivingPage: React.FC = () => {
  const { user, getCurrentBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const currentBranch = getCurrentBranch();

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" message="กำลังโหลดข้อมูลการรับสินค้า..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <TruckIcon className="h-8 w-8 mr-3 text-primary-600" />
            รับสินค้าเข้าสต๊อค
          </h1>
          <p className="text-gray-600 mt-1">
            บันทึกการรับสินค้าเข้าสต๊อค {currentBranch?.name}
          </p>
        </div>
        
        <button
          onClick={() => toast.success('ฟีเจอร์นี้กำลังพัฒนา')}
          className="btn btn-primary flex items-center"
        >
          <QrCodeIcon className="h-5 w-5 mr-2" />
          สแกนรับสินค้า
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body text-center">
            <TruckIcon className="h-12 w-12 text-primary-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              รับสินค้าใหม่
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              บันทึกสินค้าที่ได้รับจากคลังสินค้า
            </p>
            <button 
              onClick={() => toast.info('ฟีเจอร์กำลังพัฒนา')}
              className="btn btn-outline w-full"
            >
              เริ่มรับสินค้า
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-center">
            <QrCodeIcon className="h-12 w-12 text-success-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              สแกน QR Code
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              ใช้ QR Code สำหรับรับสินค้าอย่างรวดเร็ว
            </p>
            <button 
              onClick={() => toast.info('ฟีเจอร์กำลังพัฒนา')}
              className="btn btn-outline w-full"
            >
              เปิดสแกนเนอร์
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-center">
            <CheckIcon className="h-12 w-12 text-warning-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ตรวจสอบการรับ
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              ตรวจสอบประวัติการรับสินค้า
            </p>
            <button 
              onClick={() => toast.info('ฟีเจอร์กำลังพัฒนา')}
              className="btn btn-outline w-full"
            >
              ดูประวัติ
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10"
              placeholder="ค้นหาประวัติการรับสินค้า..."
            />
          </div>
        </div>
      </div>

      {/* Receiving History */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">ประวัติการรับสินค้า</h3>
        </div>
        <div className="card-body">
          <div className="text-center py-12">
            <TruckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              ยังไม่มีประวัติการรับสินค้า
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

export default ReceivingPage;