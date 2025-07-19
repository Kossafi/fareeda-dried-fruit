import React, { useState, useEffect } from 'react';
import {
  UserIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ClockIcon,
  IdentificationIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@contexts/AuthContext';
import { DemoEmployee } from '@data/demoAccounts';
import { UserRole } from '@types/index';
import clsx from 'clsx';

const EmployeeInfoCard: React.FC = () => {
  const { user, dailySession, getCurrentBranch } = useAuth();
  const [demoEmployee, setDemoEmployee] = useState<DemoEmployee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const currentBranch = getCurrentBranch();

  // Load demo employee info
  useEffect(() => {
    const demoEmployeeStr = localStorage.getItem('demoEmployee');
    if (demoEmployeeStr) {
      try {
        const employee = JSON.parse(demoEmployeeStr);
        setDemoEmployee(employee);
      } catch (error) {
        console.error('Failed to parse demo employee:', error);
      }
    }
  }, [user]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getRoleDisplay = (role: UserRole) => {
    switch (role) {
      case UserRole.STAFF:
        return { label: 'พนักงานขาย', color: 'text-blue-600 bg-blue-100' };
      case UserRole.MANAGER:
        return { label: 'ผู้จัดการสาขา', color: 'text-purple-600 bg-purple-100' };
      case UserRole.ADMIN:
        return { label: 'ผู้ดูแลระบบ', color: 'text-red-600 bg-red-100' };
      default:
        return { label: 'ไม่ระบุ', color: 'text-gray-600 bg-gray-100' };
    }
  };

  const getWorkingDuration = () => {
    if (!dailySession?.startTime) return null;
    
    const startTime = new Date(dailySession.startTime);
    const now = currentTime;
    const diffMs = now.getTime() - startTime.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours} ชม. ${minutes} นาที`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!user) return null;

  const roleInfo = getRoleDisplay(user.role);
  const workingDuration = getWorkingDuration();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-lg">
            {demoEmployee?.avatar || '👤'}
          </div>
          
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {user.firstName} {user.lastName}
            </h3>
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              roleInfo.color
            )}>
              {roleInfo.label}
            </span>
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className="text-right">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success-500 rounded-full"></div>
            <span className="text-sm text-success-600">ออนไลน์</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatTime(currentTime)}
          </p>
        </div>
      </div>

      {/* Employee Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div className="flex items-center text-sm">
            <IdentificationIcon className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-600">รหัส:</span>
            <span className="ml-2 font-mono font-medium">{user.employeeId || demoEmployee?.employeeId}</span>
          </div>
          
          {demoEmployee?.email && (
            <div className="flex items-center text-sm">
              <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">Email:</span>
              <span className="ml-2 text-blue-600 text-xs">{demoEmployee.email}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          {currentBranch && (
            <div className="flex items-center text-sm">
              <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">สาขา:</span>
              <span className="ml-2 font-medium">{currentBranch.code}</span>
            </div>
          )}
          
          {demoEmployee?.phone && (
            <div className="flex items-center text-sm">
              <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">โทร:</span>
              <span className="ml-2">{demoEmployee.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Working Session Info */}
      {dailySession && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            ข้อมูลการทำงานวันนี้
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">เข้างาน:</span>
                <span className="ml-2 font-medium">
                  {new Date(dailySession.startTime).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              
              {workingDuration && (
                <div className="flex items-center text-sm">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">ระยะเวลา:</span>
                  <span className="ml-2 font-medium text-success-600">{workingDuration}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">สาขา:</span>
                <span className="ml-2 font-medium">{dailySession.branchName}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 mr-2 flex items-center justify-center">
                  🔒
                </div>
                <span className="text-gray-600">สถานะ:</span>
                <span className="ml-2 text-warning-600 font-medium">
                  {dailySession.isLocked ? 'ล็อคแล้ว' : 'ปลดล็อค'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Branch Info */}
          {currentBranch && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentBranch.name}</p>
                  <p className="text-xs text-gray-600">{currentBranch.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">รหัสสาขา</p>
                  <p className="text-sm font-mono font-bold text-primary-600">{currentBranch.code}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeInfoCard;