import React, { useState, useEffect } from 'react';
import { Transition } from '@headlessui/react';
import {
  WifiIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ConnectionStatusProps {
  connected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connected }) => {
  const [show, setShow] = useState(false);
  const [lastConnectionState, setLastConnectionState] = useState(connected);

  useEffect(() => {
    // Show notification when connection state changes
    if (lastConnectionState !== connected) {
      setShow(true);
      setLastConnectionState(connected);

      // Auto-hide after 5 seconds if connected
      if (connected) {
        const timer = setTimeout(() => {
          setShow(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [connected, lastConnectionState]);

  // Don't show anything if we haven't had a connection state change
  if (lastConnectionState === connected && !show) {
    return null;
  }

  return (
    <Transition
      show={show}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
        <div className={clsx(
          'rounded-lg p-4 shadow-lg ring-1 ring-black ring-opacity-5',
          connected 
            ? 'bg-success-50 border border-success-200' 
            : 'bg-danger-50 border border-danger-200'
        )}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {connected ? (
                <WifiIcon className="h-5 w-5 text-success-400" aria-hidden="true" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" aria-hidden="true" />
              )}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className={clsx(
                'text-sm font-medium',
                connected ? 'text-success-800' : 'text-danger-800'
              )}>
                {connected ? 'เชื่อมต่อสำเร็จแล้ว' : 'ขาดการเชื่อมต่อ'}
              </p>
              <p className={clsx(
                'text-sm mt-1',
                connected ? 'text-success-700' : 'text-danger-700'
              )}>
                {connected 
                  ? 'ระบบจะอัปเดตข้อมูลแบบเรียลไทม์'
                  : 'บางฟีเจอร์อาจไม่ทำงานแบบเรียลไทม์'
                }
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className={clsx(
                  'rounded-md inline-flex text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2',
                  connected 
                    ? 'text-success-800 hover:text-success-600 focus:ring-success-500' 
                    : 'text-danger-800 hover:text-danger-600 focus:ring-danger-500'
                )}
                onClick={() => setShow(false)}
              >
                <span className="sr-only">ปิด</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export default ConnectionStatus;