import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { StockLevel, ProductUnit } from '@types/index';
import LoadingSpinner from '@components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface StockAdjustmentModalProps {
  stock: StockLevel;
  onSubmit: (adjustment: {
    quantity: number;
    type: 'increase' | 'decrease';
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  stock,
  onSubmit,
  onClose,
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    
    if (!qty || qty <= 0) {
      toast.error('กรุณาระบุจำนวนที่ถูกต้อง');
      return;
    }

    if (!notes.trim()) {
      toast.error('กรุณาระบุหมายเหตุ');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        quantity: qty,
        type: adjustmentType,
        notes: notes.trim(),
      });
    } catch (error) {
      console.error('Stock adjustment failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateNewQuantity = () => {
    const qty = parseFloat(quantity);
    if (!qty) return stock.quantity;
    
    if (adjustmentType === 'increase') {
      return stock.quantity + qty;
    } else {
      return Math.max(0, stock.quantity - qty);
    }
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <AdjustmentsHorizontalIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      ปรับปรุงสต๊อค
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">{stock.product.name}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">SKU:</p>
                      <p className="font-medium">{stock.product.sku}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">ปัจจุบัน:</p>
                      <p className="font-medium text-lg">
                        {stock.quantity.toLocaleString()} {getUnitDisplay(stock.product.unit)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Adjustment Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ประเภทการปรับปรุง
                  </label>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setAdjustmentType('increase')}
                      className={clsx(
                        'flex-1 flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-colors duration-200',
                        adjustmentType === 'increase'
                          ? 'border-success-500 bg-success-50 text-success-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      )}
                    >
                      <PlusIcon className="h-5 w-5 mr-2" />
                      เพิ่มสต๊อค
                    </button>
                    <button
                      onClick={() => setAdjustmentType('decrease')}
                      className={clsx(
                        'flex-1 flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-colors duration-200',
                        adjustmentType === 'decrease'
                          ? 'border-danger-500 bg-danger-50 text-danger-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      )}
                    >
                      <MinusIcon className="h-5 w-5 mr-2" />
                      ลดสต๊อค
                    </button>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    จำนวนที่ต้องการ{adjustmentType === 'increase' ? 'เพิ่ม' : 'ลด'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="form-input pr-16"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <span className="text-sm text-gray-500">
                        {getUnitDisplay(stock.product.unit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {quantity && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">ปริมาณหลังปรับปรุง:</span>
                      <span className="font-medium text-blue-900">
                        {calculateNewQuantity().toLocaleString()} {getUnitDisplay(stock.product.unit)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมายเหตุ *
                  </label>
                  <div className="relative">
                    <DocumentTextIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                      placeholder="เช่น ได้รับสินค้าใหม่, สินค้าหมดอายุ, แก้ไขข้อผิดพลาด..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 btn btn-outline"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!quantity || !notes.trim() || isSubmitting}
                    className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <LoadingSpinner size="small" message="กำลังบันทึก..." />
                    ) : (
                      'บันทึกการปรับปรุง'
                    )}
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

export default StockAdjustmentModal;