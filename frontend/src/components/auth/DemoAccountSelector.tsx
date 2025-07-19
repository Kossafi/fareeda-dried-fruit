import React, { useState } from 'react';
import {
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { demoEmployees, DemoEmployee } from '@data/demoAccounts';
import { UserRole } from '@types/index';
import clsx from 'clsx';

interface DemoAccountSelectorProps {
  onAccountSelect: (username: string, password: string) => void;
  loading?: boolean;
}

const DemoAccountSelector: React.FC<DemoAccountSelectorProps> = ({ 
  onAccountSelect, 
  loading = false 
}) => {
  const [selectedAccount, setSelectedAccount] = useState<DemoEmployee | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  const getBranchCount = (employee: DemoEmployee) => {
    return employee.allowedBranches.length;
  };

  const handleAccountSelect = (account: DemoEmployee) => {
    setSelectedAccount(account);
  };

  const handleLogin = () => {
    if (selectedAccount) {
      onAccountSelect(selectedAccount.username, selectedAccount.password);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <UsersIcon className="mx-auto h-12 w-12 text-primary-600" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          เลือก Demo Account
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          เลือกบัญชีผู้ใช้สำหรับทดสอบระบบ
        </p>
      </div>

      {/* Account Cards */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {demoEmployees.map((employee) => {
          const roleInfo = getRoleDisplay(employee.role);
          const isSelected = selectedAccount?.id === employee.id;
          
          return (
            <button
              key={employee.id}
              onClick={() => handleAccountSelect(employee)}
              className={clsx(
                'w-full text-left p-4 border-2 rounded-lg transition-all duration-200',
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg',
                    isSelected ? 'bg-primary-100' : 'bg-gray-100'
                  )}>
                    {employee.avatar || '👤'}
                  </div>
                  
                  {/* Employee Info */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </h4>
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        roleInfo.color
                      )}>
                        {roleInfo.label}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600">
                        👤 {employee.employeeId} • 📧 {employee.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        🏢 เข้าถึงได้ {getBranchCount(employee)} สาขา
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Selection Indicator */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                      <ArrowRightIcon className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Account Details */}
      {selectedAccount && (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            ข้อมูลการเข้าสู่ระบบ
          </h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Username:</span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {selectedAccount.username}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Password:</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono font-medium text-gray-900">
                  {showPassword ? selectedAccount.password : '••••••'}
                </span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">สาขาที่เข้าถึงได้:</span>
              <span className="text-sm font-medium text-primary-600">
                {getBranchCount(selectedAccount)} สาขา
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Login Button */}
      <button
        onClick={handleLogin}
        disabled={!selectedAccount || loading}
        className={clsx(
          'w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg transition-colors duration-200',
          selectedAccount && !loading
            ? 'text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            : 'text-gray-400 bg-gray-100 cursor-not-allowed'
        )}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            กำลังเข้าสู่ระบบ...
          </>
        ) : (
          <>
            <UserIcon className="h-4 w-4 mr-2" />
            เข้าสู่ระบบด้วยบัญชีนี้
          </>
        )}
      </button>

      {/* Info Note */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          💡 เลือกบัญชีเพื่อทดสอบระบบ Branch Login
        </p>
        <p className="text-xs text-gray-400 mt-1">
          แต่ละบัญชีมีสิทธิ์เข้าถึงสาขาที่แตกต่างกัน
        </p>
      </div>
    </div>
  );
};

export default DemoAccountSelector;