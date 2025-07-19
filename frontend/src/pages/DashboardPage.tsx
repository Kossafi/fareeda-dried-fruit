import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocket } from '@contexts/SocketContext';
import {
  ShoppingCartIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@components/common/LoadingSpinner';
import { UserRole } from '@types/index';

interface DashboardStats {
  todaySales: number;
  totalQuantitySold: number;
  lowStockItems: number;
  pendingOrders: number;
  totalProducts: number;
  branchStock: number;
}

const DashboardPage: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const { connected, subscribeToSalesFeed, subscribeToLowStockAlerts } = useSocket();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    totalQuantitySold: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    totalProducts: 0,
    branchStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    // Subscribe to real-time updates
    subscribeToSalesFeed();
    subscribeToLowStockAlerts();
    
    // Load dashboard data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API calls
      setTimeout(() => {
        setStats({
          todaySales: 47,
          totalQuantitySold: 1250,
          lowStockItems: 5,
          pendingOrders: 3,
          totalProducts: 45,
          branchStock: 8750,
        });
        
        setRecentActivities([
          {
            id: 1,
            type: 'sale',
            message: 'ขายเสร็จ: อัลมอนด์ 500กรัม',
            time: '5 นาทีที่แล้ว',
            icon: ShoppingCartIcon,
            color: 'text-success-600',
            bgColor: 'bg-success-100',
          },
          {
            id: 2,
            type: 'low-stock',
            message: 'สินค้าใกล้หมด: ลูกคิวีอ่อน',
            time: '15 นาทีที่แล้ว',
            icon: ExclamationTriangleIcon,
            color: 'text-warning-600',
            bgColor: 'bg-warning-100',
          },
          {
            id: 3,
            type: 'delivery',
            message: 'รับสินค้าเข้าคลัง: 15 รายการ',
            time: '1 ชั่วโมงที่แล้ว',
            icon: TruckIcon,
            color: 'text-primary-600',
            bgColor: 'bg-primary-100',
          },
          {
            id: 4,
            type: 'sale',
            message: 'ขายเสร็จ: มะม่วงอ่อน 750กรัม',
            time: '2 ชั่วโมงที่แล้ว',
            icon: ShoppingCartIcon,
            color: 'text-success-600',
            bgColor: 'bg-success-100',
          },
        ]);
        
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" message="กำลังโหลดข้อมูล..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              ยินดีต้อนรับ, {user?.username}!
            </h1>
            <p className="text-primary-100 mt-1">
              วันนี้คือ {new Date().toLocaleDateString('th-TH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {user?.branch && (
              <p className="text-primary-200 text-sm">
                สาขา: {user.branch.name}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-sm">
                {connected ? 'เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ'}
              </span>
            </div>
            <p className="text-xs text-primary-200 mt-1">
              อัปเดตแบบเรียลไทม์
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {/* Today's Sales */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <ShoppingCartIcon className="w-5 h-5 text-success-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">ขายวันนี้</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todaySales}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Quantity Sold */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">จำนวนขาย</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalQuantitySold.toLocaleString()}</p>
                <p className="text-xs text-gray-500">กรัม</p>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">สินค้าใกล้หมด</p>
                <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Orders */}
        {hasAnyRole([UserRole.MANAGER, UserRole.ADMIN]) && (
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">รออนุมัติ</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
                  <p className="text-xs text-gray-500">ใบสั่งซื้อ</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Total Products */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CubeIcon className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">สินค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Branch Stock */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <CubeIcon className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">สต๊อคสาขา</p>
                <p className="text-2xl font-bold text-gray-900">{stats.branchStock.toLocaleString()}</p>
                <p className="text-xs text-gray-500">กรัม</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activities Feed */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              กิจกรรมล่าสุด
            </h3>
            <p className="text-sm text-gray-500">
              กิจกรรมที่เกิดขึ้นในระบบ
            </p>
          </div>
          <div className="card-body">
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivities.map((activity, index) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {index !== recentActivities.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${activity.bgColor}`}>
                            <activity.icon className={`h-4 w-4 ${activity.color}`} aria-hidden="true" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-900">{activity.message}</p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time>{activity.time}</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              คำสั่งด่วน
            </h3>
            <p className="text-sm text-gray-500">
              ฟังก์ชันที่ใช้บ่อย
            </p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {/* Record Sale */}
              <a
                href="/sales"
                className="group block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ShoppingCartIcon className="h-6 w-6 text-gray-400 group-hover:text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                      บันทึกขาย
                    </p>
                    <p className="text-xs text-gray-500 group-hover:text-primary-700">
                      บันทึกการขายใหม่
                    </p>
                  </div>
                </div>
              </a>

              {/* Check Stock */}
              {hasAnyRole([UserRole.MANAGER, UserRole.ADMIN]) && (
                <a
                  href="/stock"
                  className="group block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CubeIcon className="h-6 w-6 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                        ตรวจสต๊อค
                      </p>
                      <p className="text-xs text-gray-500 group-hover:text-primary-700">
                        ดูสถานะสต๊อค
                      </p>
                    </div>
                  </div>
                </a>
              )}

              {/* Create Purchase Order */}
              {hasAnyRole([UserRole.MANAGER, UserRole.ADMIN]) && (
                <a
                  href="/purchase-orders"
                  className="group block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-6 w-6 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                        สั่งซื้อ
                      </p>
                      <p className="text-xs text-gray-500 group-hover:text-primary-700">
                        สร้างใบสั่งซื้อ
                      </p>
                    </div>
                  </div>
                </a>
              )}

              {/* View Analytics */}
              {hasAnyRole([UserRole.MANAGER, UserRole.ADMIN]) && (
                <a
                  href="/analytics"
                  className="group block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-6 w-6 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
                        รายงาน
                      </p>
                      <p className="text-xs text-gray-500 group-hover:text-primary-700">
                        ดูรายงานและสถิติ
                      </p>
                    </div>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;