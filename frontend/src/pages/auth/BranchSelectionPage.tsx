import React, { useState, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Branch } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const BranchSelectionPage: React.FC = () => {
  const { 
    user, 
    availableBranches, 
    selectDailyBranch, 
    loadAvailableBranches,
    needsBranchSelection,
    loading 
  } = useAuth();
  const navigate = useNavigate();
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load branches when component mounts
  useEffect(() => {
    if (availableBranches.length === 0) {
      loadAvailableBranches();
    }
  }, [availableBranches.length, loadAvailableBranches]);

  // Redirect if user doesn't need branch selection
  useEffect(() => {
    if (!needsBranchSelection && user) {
      navigate('/dashboard');
    }
  }, [needsBranchSelection, user, navigate]);

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
  };

  const handleConfirmSelection = async () => {
    if (!selectedBranchId) {
      toast.error('กรุณาเลือกสาขาที่ต้องการทำงาน');
      return;
    }

    try {
      setIsSubmitting(true);
      await selectDailyBranch(selectedBranchId);
      
      // Navigate to dashboard after successful selection
      navigate('/dashboard');
    } catch (error) {
      console.error('Branch selection failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTodayDate = () => {
    return new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getCurrentTime = () => {
    return currentTime.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <LoadingSpinner size="large" message="กำลังโหลดข้อมูลสาขา..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Header */}
          <div className="text-center">
            <BuildingStorefrontIcon className="mx-auto h-16 w-16 text-primary-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              เลือกสาขาที่ทำงาน
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              เลือกสาขาที่คุณต้องการทำงานในวันนี้
            </p>
          </div>

          {/* User Info Card */}
          <div className="mt-8 bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {user?.username}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {user?.role}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <CalendarDaysIcon className="h-4 w-4 mr-2" />
                <span>{getTodayDate()}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <ClockIcon className="h-4 w-4 mr-2" />
                <span className="font-mono">{getCurrentTime()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
            {/* Warning Notice */}
            <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-5 w-5 text-warning-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-warning-800">
                    ข้อมูลสำคัญ
                  </h3>
                  <div className="mt-2 text-sm text-warning-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>เมื่อเลือกสาขาแล้ว จะถูกล็อคไว้ตลอดวัน</li>
                      <li>ไม่สามารถเปลี่ยนสาขาได้จนกว่าจะหมดวัน</li>
                      <li>หากต้องการย้ายสาขา ต้องขออนุมัติจากผู้จัดการ</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                เลือกสาขาที่ต้องการทำงาน
              </h3>
              
              {availableBranches.length > 0 ? (
                <div className="space-y-3">
                  {availableBranches.map((branch: Branch) => (
                    <button
                      key={branch.id}
                      onClick={() => handleBranchSelect(branch.id)}
                      className={clsx(
                        'w-full text-left p-4 border-2 rounded-lg transition-all duration-200',
                        selectedBranchId === branch.id
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={clsx(
                            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                            selectedBranchId === branch.id
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          )}>
                            <BuildingStorefrontIcon className="h-5 w-5" />
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {branch.name}
                            </h4>
                            <div className="flex items-center mt-1 text-xs text-gray-500">
                              <MapPinIcon className="h-3 w-3 mr-1" />
                              <span>{branch.location}</span>
                            </div>
                          </div>
                        </div>
                        
                        {selectedBranchId === branch.id && (
                          <div className="flex-shrink-0">
                            <CheckIcon className="h-5 w-5 text-primary-600" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BuildingStorefrontIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    ไม่พบสาขาที่สามารถเลือกได้
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex space-x-4">
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedBranchId || isSubmitting}
                className={clsx(
                  'flex-1 flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg transition-colors duration-200',
                  selectedBranchId && !isSubmitting
                    ? 'text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <LoadingSpinner size="small" message="กำลังเลือก..." />
                ) : (
                  <>
                    <span>เริ่มทำงาน</span>
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Selected Branch Summary */}
            {selectedBranchId && (
              <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
                <div className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-success-400 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-success-800">
                      สาขาที่เลือก: {availableBranches.find(b => b.id === selectedBranchId)?.name}
                    </p>
                    <p className="text-xs text-success-600 mt-1">
                      คุณจะทำงานที่สาขานี้ตลอดวันนี้
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchSelectionPage;