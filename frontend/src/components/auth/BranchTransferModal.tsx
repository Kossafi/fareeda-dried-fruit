import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  BuildingStorefrontIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@contexts/AuthContext';
import { Branch } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface BranchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BranchTransferModal: React.FC<BranchTransferModalProps> = ({ isOpen, onClose }) => {
  const {
    availableBranches,
    dailySession,
    getCurrentBranch,
    requestBranchTransfer,
    transferRequest
  } = useAuth();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentBranch = getCurrentBranch();
  const availableTargetBranches = availableBranches.filter(
    branch => branch.id !== dailySession?.branchId
  );

  const handleSubmit = async () => {
    if (!selectedBranchId) {
      toast.error('กรุณาเลือกสาขาที่ต้องการย้าย');
      return;
    }

    if (!reason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการขอย้ายสาขา');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestBranchTransfer(selectedBranchId, reason.trim());
      
      // Reset form
      setSelectedBranchId('');
      setReason('');
      onClose();
    } catch (error) {
      console.error('Transfer request failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransferRequestStatus = () => {
    if (!transferRequest) return null;

    switch (transferRequest.status) {
      case 'pending':
        return {
          color: 'text-warning-600 bg-warning-100',
          icon: ClockIcon,
          text: 'รอการอนุมัติ'
        };
      case 'approved':
        return {
          color: 'text-success-600 bg-success-100',
          icon: ClockIcon,
          text: 'อนุมัติแล้ว'
        };
      case 'rejected':
        return {
          color: 'text-danger-600 bg-danger-100',
          icon: XMarkIcon,
          text: 'ปฏิเสธ'
        };
      default:
        return null;
    }
  };

  const statusInfo = getTransferRequestStatus();

  return (
    <Transition show={isOpen} as={Fragment}>
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <BuildingStorefrontIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      ขอย้ายสาขา
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Current Status */}
                {transferRequest && statusInfo && (
                  <div className="mb-6 p-4 rounded-lg border">
                    <div className="flex items-center">
                      <statusInfo.icon className="h-5 w-5 text-warning-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          คำขอย้ายสาขาปัจจุบัน
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          ไป: {availableBranches.find(b => b.id === transferRequest.toBranchId)?.name}
                        </p>
                        <span className={clsx(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2',
                          statusInfo.color
                        )}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Branch Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    สาขาปัจจุบัน
                  </h4>
                  <div className="flex items-center">
                    <BuildingStorefrontIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {currentBranch?.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {currentBranch?.location}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-lg">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-warning-400 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-warning-800">
                        ข้อสำคัญ
                      </h4>
                      <ul className="mt-2 text-xs text-warning-700 space-y-1">
                        <li>• การขอย้ายสาขาต้องรอการอนุมัติจากผู้จัดการ</li>
                        <li>• เมื่อได้รับการอนุมัติ คุณจะต้องเลือกสาขาใหม่</li>
                        <li>• ข้อมูลการทำงานจะถูกบันทึกแยกต่างสาขา</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Branch Selection */}
                {!transferRequest && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เลือกสาขาที่ต้องการย้าย *
                      </label>
                      <div className="space-y-2">
                        {availableTargetBranches.map((branch: Branch) => (
                          <button
                            key={branch.id}
                            onClick={() => setSelectedBranchId(branch.id)}
                            className={clsx(
                              'w-full text-left p-3 border rounded-lg transition-colors duration-200',
                              selectedBranchId === branch.id
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mr-2" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {branch.name}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {branch.location}
                                  </p>
                                </div>
                              </div>
                              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reason Input */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เหตุผลในการขอย้ายสาขา *
                      </label>
                      <div className="relative">
                        <DocumentTextIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={3}
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                          placeholder="เช่น ต้องช่วยงานสาขาอื่น, มีลูกค้าหาเฉพาะ, เหตุฉุกเฉิน..."
                          maxLength={200}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {reason.length}/200 ตัวอักษร
                      </p>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 btn btn-outline"
                  >
                    ยกเลิก
                  </button>
                  
                  {!transferRequest && (
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedBranchId || !reason.trim() || isSubmitting}
                      className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <LoadingSpinner size="small" message="กำลังส่ง..." />
                      ) : (
                        'ส่งคำขอ'
                      )}
                    </button>
                  )}
                </div>

                {/* Transfer History */}
                {transferRequest && (
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">
                      ส่งคำขอเมื่อ: {new Date(transferRequest.requestedAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BranchTransferModal;