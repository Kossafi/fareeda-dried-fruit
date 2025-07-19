import React, { useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocket } from '@contexts/SocketContext';
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import BranchTransferModal from '@components/auth/BranchTransferModal';
import clsx from 'clsx';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { 
    user, 
    logout, 
    dailySession, 
    getCurrentBranch, 
    canTransferBranch,
    transferRequest,
    endDailySession
  } = useAuth();
  const { connected } = useSocket();
  const [showTransferModal, setShowTransferModal] = useState(false);
  
  const currentBranch = getCurrentBranch();

  const currentTime = new Date().toLocaleString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Left side */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden -ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              onClick={onMenuClick}
            >
              <span className="sr-only">เปิดเมนู</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Page title and branch info */}
            <div className="ml-4 lg:ml-0">
              <h1 className="text-lg font-semibold text-gray-900">
                ระบบจัดการสต๊อค
              </h1>
              <div className="flex items-center space-x-3 text-sm text-gray-500">
                <span>{currentTime}</span>
                {currentBranch && (
                  <>
                    <span>•</span>
                    <div className="flex items-center">
                      <BuildingStorefrontIcon className="h-4 w-4 mr-1" />
                      <span className="font-medium">{currentBranch.name}</span>
                      {dailySession?.isLocked && (
                        <span className="ml-1 text-xs text-warning-600">(ล็อค)</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Connection status indicator */}
            <div className="flex items-center space-x-2">
              <div className={clsx(
                'h-2 w-2 rounded-full',
                connected ? 'bg-success-500' : 'bg-danger-500'
              )} />
              <span className="text-xs text-gray-500">
                {connected ? 'เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ'}
              </span>
            </div>

            {/* Notifications */}
            <button
              type="button"
              className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span className="sr-only">ดูการแจ้งเตือน</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
              {/* Notification badge */}
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger-500 flex items-center justify-center">
                <span className="text-xs font-medium text-white">3</span>
              </span>
            </button>

            {/* Profile dropdown */}
            <Menu as="div" className="relative ml-3">
              <div>
                <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                  <span className="sr-only">เปิดเมนูผู้ใช้</span>
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <UserCircleIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="ml-3 hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-700">
                      {user?.username}
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentBranch?.name || 'ไม่ได้เลือกสาขา'}
                    </p>
                  </div>
                </Menu.Button>
              </div>
              
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {/* Current Branch Info */}
                  {currentBranch && dailySession && (
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {currentBranch.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              เริ่มงาน: {new Date(dailySession.startTime).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        {dailySession.isLocked && (
                          <span className="text-xs px-2 py-1 bg-warning-100 text-warning-800 rounded-full">
                            ล็อค
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/profile"
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block px-4 py-2 text-sm text-gray-700'
                        )}
                      >
                        โปรไฟล์ของคุณ
                      </a>
                    )}
                  </Menu.Item>
                  
                  {/* Branch Transfer */}
                  {canTransferBranch() && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => setShowTransferModal(true)}
                          className={clsx(
                            active ? 'bg-gray-100' : '',
                            'block w-full text-left px-4 py-2 text-sm text-gray-700 flex items-center'
                          )}
                        >
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          ขอย้ายสาขา
                          {transferRequest && (
                            <span className="ml-auto text-xs px-2 py-0.5 bg-warning-100 text-warning-800 rounded-full">
                              รออนุมัติ
                            </span>
                          )}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  
                  {/* End Daily Session */}
                  {dailySession?.isLocked && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={endDailySession}
                          className={clsx(
                            active ? 'bg-gray-100' : '',
                            'block w-full text-left px-4 py-2 text-sm text-gray-700 flex items-center'
                          )}
                        >
                          <ClockIcon className="h-4 w-4 mr-2" />
                          สิ้นสุดวันทำงาน
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  
                  <div className="border-t border-gray-200 my-1" />
                  
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="#"
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block px-4 py-2 text-sm text-gray-700'
                        )}
                      >
                        ตั้งค่า
                      </a>
                    )}
                  </Menu.Item>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={logout}
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block w-full text-left px-4 py-2 text-sm text-gray-700'
                        )}
                      >
                        ออกจากระบบ
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
      
      {/* Branch Transfer Modal */}
      <BranchTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
      />
    </header>
  );
};

export default Header;