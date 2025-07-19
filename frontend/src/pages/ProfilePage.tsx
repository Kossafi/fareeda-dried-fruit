import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { UserRole } from '@types/index';
import {
  UserCircleIcon,
  BuildingOfficeIcon,
  IdentificationIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import EmployeeInfoCard from '@components/common/EmployeeInfoCard';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'ผู้ดูแลระบบ';
      case UserRole.MANAGER:
        return 'ผู้จัดการ';
      case UserRole.STAFF:
        return 'พนักงาน';
      default:
        return role;
    }
  };

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-gray-500">ไม่พบข้อมูลผู้ใช้</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของคุณ</h1>
        <p className="text-gray-600">ข้อมูลบัญชีผู้ใช้และการตั้งค่า</p>
      </div>

      {/* Employee Info Card */}
      <div className="mb-8">
        <EmployeeInfoCard />
      </div>

      {/* Profile Card */}
      <div className="card mb-8">
        <div className="card-body">
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-24 w-24 bg-gray-300 rounded-full flex items-center justify-center">
                <UserCircleIcon className="h-16 w-16 text-gray-600" />
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {user.username}
              </h2>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <IdentificationIcon className="h-4 w-4 mr-2" />
                  <span>{getRoleDisplayName(user.role)}</span>
                </div>
                
                {user.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{user.email}</span>
                  </div>
                )}
                
                {user.branch && (
                  <div className="flex items-center text-sm text-gray-600">
                    <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                    <span>{user.branch.name}</span>
                    {user.branch.location && (
                      <span className="text-gray-400 ml-2">({user.branch.location})</span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>สมาชิกตั้งแต่: {new Date(user.createdAt).toLocaleDateString('th-TH')}</span>
                </div>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="flex-shrink-0">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                user.isActive 
                  ? 'bg-success-100 text-success-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {user.isActive ? 'ใช้งานอยู่' : 'ไม่ได้ใช้งาน'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">ข้อมูลพื้นฐาน</h3>
          </div>
          <div className="card-body">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">ชื่อผู้ใช้</dt>
                <dd className="text-sm text-gray-900">{user.username}</dd>
              </div>
              
              {user.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">อีเมล</dt>
                  <dd className="text-sm text-gray-900">{user.email}</dd>
                </div>
              )}
              
              <div>
                <dt className="text-sm font-medium text-gray-500">บทบาท</dt>
                <dd className="text-sm text-gray-900">{getRoleDisplayName(user.role)}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">สถานะ</dt>
                <dd className="text-sm text-gray-900">
                  {user.isActive ? (
                    <span className="text-success-600">ใช้งานอยู่</span>
                  ) : (
                    <span className="text-gray-500">ไม่ได้ใช้งาน</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Branch Information */}
        {user.branch && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">ข้อมูลสาขา</h3>
            </div>
            <div className="card-body">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">ชื่อสาขา</dt>
                  <dd className="text-sm text-gray-900">{user.branch.name}</dd>
                </div>
                
                {user.branch.location && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ที่ตั้ง</dt>
                    <dd className="text-sm text-gray-900">{user.branch.location}</dd>
                  </div>
                )}
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">สถานะสาขา</dt>
                  <dd className="text-sm text-gray-900">
                    {user.branch.isActive ? (
                      <span className="text-success-600">เปิดใช้งาน</span>
                    ) : (
                      <span className="text-gray-500">ปิดใช้งาน</span>
                    )}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">วันที่สร้าง</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(user.branch.createdAt).toLocaleDateString('th-TH')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Account Timeline */}
      <div className="card mt-6">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">ประวัติบัญชี</h3>
        </div>
        <div className="card-body">
          <div className="flow-root">
            <ul className="-mb-8">
              <li>
                <div className="relative pb-8">
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-success-500 flex items-center justify-center ring-8 ring-white">
                        <UserCircleIcon className="h-4 w-4 text-white" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-900">สร้างบัญชีผู้ใช้</p>
                        <p className="text-xs text-gray-500">บัญชีถูกสร้างเรียบร้อยแล้ว</p>
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500">
                        <time>{new Date(user.createdAt).toLocaleDateString('th-TH')}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="relative pb-8">
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center ring-8 ring-white">
                        <CalendarIcon className="h-4 w-4 text-white" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-900">อัปเดตข้อมูลล่าสุด</p>
                        <p className="text-xs text-gray-500">ข้อมูลบัญชีถูกอัปเดตล่าสุด</p>
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500">
                        <time>{new Date(user.updatedAt).toLocaleDateString('th-TH')}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;