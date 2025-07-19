import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  ScaleIcon,
  XMarkIcon,
  CheckIcon,
  BackspaceIcon,
} from '@heroicons/react/24/outline';
import { Product, ProductUnit } from '@types/index';
import clsx from 'clsx';

interface WeightInputModalProps {
  product: Product;
  onSubmit: (weight: number, unit: ProductUnit) => void;
  onClose: () => void;
}

const WeightInputModal: React.FC<WeightInputModalProps> = ({ product, onSubmit, onClose }) => {
  const [weightInput, setWeightInput] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit>(product.unit);
  const [isValid, setIsValid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on input when modal opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    // Validate weight input
    const weight = parseFloat(weightInput);
    setIsValid(weightInput !== '' && !isNaN(weight) && weight > 0 && weight <= 10000);
  }, [weightInput]);

  const handleNumberPad = (digit: string) => {
    if (weightInput.length < 8) { // Limit input length
      setWeightInput(prev => prev + digit);
    }
  };

  const handleDecimal = () => {
    if (!weightInput.includes('.') && weightInput !== '') {
      setWeightInput(prev => prev + '.');
    }
  };

  const handleBackspace = () => {
    setWeightInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setWeightInput('');
  };

  const handleSubmit = () => {
    if (isValid) {
      const weight = parseFloat(weightInput);
      onSubmit(weight, selectedUnit);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Number pad layout
  const numberPadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['.', '0', 'backspace']
  ];

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
                    <ScaleIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      กรอกน้ำหนัก
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
                  <h3 className="font-medium text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-600">
                    SKU: {product.sku} • หน่วย: {product.unit}
                  </p>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-1">{product.description}</p>
                  )}
                </div>

                {/* Weight Display */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    น้ำหนักที่ชั่งได้ *
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={weightInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d*\.?\d*$/.test(value)) {
                          setWeightInput(value);
                        }
                      }}
                      onKeyDown={handleKeyPress}
                      className={clsx(
                        'block w-full px-4 py-4 text-2xl font-mono text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2',
                        isValid 
                          ? 'border-success-300 focus:ring-success-500 bg-success-50'
                          : weightInput === ''
                            ? 'border-gray-300 focus:ring-primary-500'
                            : 'border-danger-300 focus:ring-danger-500 bg-danger-50'
                      )}
                      placeholder="0.0"
                      autoComplete="off"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <span className="text-lg font-medium text-gray-500">
                        {selectedUnit === ProductUnit.KILOGRAM ? 'กก.' : 'กรัม'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Validation Message */}
                  <div className="mt-2 h-5">
                    {weightInput !== '' && !isValid && (
                      <p className="text-sm text-danger-600">
                        กรุณากรอกน้ำหนักที่ถูกต้อง (มากกว่า 0 และน้อยกว่า 10,000)
                      </p>
                    )}
                    {isValid && (
                      <p className="text-sm text-success-600 flex items-center">
                        <CheckIcon className="h-4 w-4 mr-1" />
                        น้ำหนักถูกต้อง
                      </p>
                    )}
                  </div>
                </div>

                {/* Unit Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    หน่วยน้ำหนัก
                  </label>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedUnit(ProductUnit.GRAM)}
                      className={clsx(
                        'flex-1 px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors duration-200',
                        selectedUnit === ProductUnit.GRAM
                          ? 'border-primary-500 bg-primary-50 text-primary-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      )}
                    >
                      กรัม (g)
                    </button>
                    <button
                      onClick={() => setSelectedUnit(ProductUnit.KILOGRAM)}
                      className={clsx(
                        'flex-1 px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors duration-200',
                        selectedUnit === ProductUnit.KILOGRAM
                          ? 'border-primary-500 bg-primary-50 text-primary-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      )}
                    >
                      กิโลกรัม (kg)
                    </button>
                  </div>
                </div>

                {/* Touch-Friendly Number Pad */}
                <div className="mb-6">
                  <div className="grid grid-cols-3 gap-2">
                    {numberPadButtons.flat().map((button, index) => {
                      if (button === 'backspace') {
                        return (
                          <button
                            key={index}
                            onClick={handleBackspace}
                            className="flex items-center justify-center h-12 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors duration-200"
                          >
                            <BackspaceIcon className="h-5 w-5" />
                          </button>
                        );
                      } else if (button === '.') {
                        return (
                          <button
                            key={index}
                            onClick={handleDecimal}
                            disabled={weightInput.includes('.') || weightInput === ''}
                            className="h-12 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg font-medium text-gray-700 transition-colors duration-200"
                          >
                            .
                          </button>
                        );
                      } else {
                        return (
                          <button
                            key={index}
                            onClick={() => handleNumberPad(button)}
                            className="h-12 bg-primary-100 hover:bg-primary-200 rounded-lg font-medium text-primary-900 transition-colors duration-200"
                          >
                            {button}
                          </button>
                        );
                      }
                    })}
                  </div>
                  
                  {/* Clear Button */}
                  <button
                    onClick={handleClear}
                    className="w-full mt-2 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors duration-200"
                  >
                    ล้าง
                  </button>
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
                    disabled={!isValid}
                    className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckIcon className="h-5 w-5 mr-2" />
                    ยืนยัน
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

export default WeightInputModal;