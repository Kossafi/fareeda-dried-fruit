import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { UserRole } from '@types/index';
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  ChartBarIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

const navigation: NavigationItem[] = [
  {
    name: 'แดชบอร์ด',
    href: '/dashboard',
    icon: HomeIcon,
    roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
  },
  {
    name: 'บันทึกการขาย',
    href: '/sales',
    icon: ShoppingCartIcon,
    roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
  },
  {
    name: 'จัดการสต๊อค',
    href: '/stock',
    icon: CubeIcon,
    roles: [UserRole.MANAGER, UserRole.ADMIN],
  },
  {
    name: 'สั่งซื้อสินค้า',
    href: '/purchase-orders',
    icon: ClipboardDocumentListIcon,
    roles: [UserRole.MANAGER, UserRole.ADMIN],
  },
  {
    name: 'รับสินค้า',
    href: '/receiving',
    icon: TruckIcon,
    roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
  },
  {
    name: 'รายงานและวิเคราะห์',
    href: '/analytics',
    icon: ChartBarIcon,
    roles: [UserRole.MANAGER, UserRole.ADMIN],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { user, logout, hasAnyRole } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <>
      {/* Mobile sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent 
          navigation={navigation}
          user={user}
          hasAnyRole={hasAnyRole}
          location={location}
          onLogout={handleLogout}
          onClose={onClose}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-white lg:shadow-xl">
        <SidebarContent 
          navigation={navigation}
          user={user}
          hasAnyRole={hasAnyRole}
          location={location}
          onLogout={handleLogout}
        />
      </div>
    </>
  );
};

interface SidebarContentProps {
  navigation: NavigationItem[];
  user: any;
  hasAnyRole: (roles: UserRole[]) => boolean;
  location: any;
  onLogout: () => void;
  onClose?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  navigation,
  user,
  hasAnyRole,
  location,
  onLogout,
  onClose
}) => {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-200 px-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <CubeIcon className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-gray-900">
              Stock Manager
            </h1>
            <p className="text-xs text-gray-500">
              ผลไม้อบแห้ง
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {navigation.map((item) => {
          if (!hasAnyRole(item.roles)) return null;

          const isActive = location.pathname === item.href;

          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                  isActive
                    ? 'bg-primary-100 text-primary-900 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <item.icon
                className={clsx(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              {item.name}
              {item.badge && (
                <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        {/* User info */}
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
              <UserCircleIcon className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.username}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.role === UserRole.ADMIN && 'ผู้ดูแลระบบ'}
              {user?.role === UserRole.MANAGER && 'ผู้จัดการ'}
              {user?.role === UserRole.STAFF && 'พนักงาน'}
              {user?.branch && ` • ${user.branch.name}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="group flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
          >
            <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            โปรไฟล์
          </NavLink>
          
          <button
            onClick={onLogout}
            className="group flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;