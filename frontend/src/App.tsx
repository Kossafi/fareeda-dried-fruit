import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@contexts/AuthContext';
import { SocketProvider } from '@contexts/SocketContext';
import ProtectedRoute from '@components/common/ProtectedRoute';
import BranchProtectedRoute from '@components/auth/BranchProtectedRoute';
import Layout from '@components/layout/Layout';

// Auth Pages
import LoginPage from '@pages/auth/LoginPage';
import BranchSelectionPage from '@pages/auth/BranchSelectionPage';

// Main Pages
import DashboardPage from '@pages/DashboardPage';
import SalesPage from '@pages/sales/SalesPage';
import StockPage from '@pages/stock/StockPage';
import PurchaseOrdersPage from '@pages/purchase/PurchaseOrdersPage';
import ReceivingPage from '@pages/receiving/ReceivingPage';
import AnalyticsPage from '@pages/analytics/AnalyticsPage';
import ProfilePage from '@pages/ProfilePage';

// Error Pages
import NotFoundPage from '@pages/error/NotFoundPage';

// User Roles
import { UserRole } from '@types/index';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/select-branch" 
              element={
                <ProtectedRoute>
                  <BranchSelectionPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Routes with Branch Selection */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <BranchProtectedRoute>
                    <Layout />
                  </BranchProtectedRoute>
                </ProtectedRoute>
              }
            >
              {/* Dashboard - Available to all authenticated users */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              
              {/* Sales - Staff and above */}
              <Route 
                path="sales" 
                element={
                  <ProtectedRoute requiredRoles={[UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]}>
                    <SalesPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Stock Management - Manager and above */}
              <Route 
                path="stock" 
                element={
                  <ProtectedRoute requiredRoles={[UserRole.MANAGER, UserRole.ADMIN]}>
                    <StockPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Purchase Orders - Manager and above */}
              <Route 
                path="purchase-orders" 
                element={
                  <ProtectedRoute requiredRoles={[UserRole.MANAGER, UserRole.ADMIN]}>
                    <PurchaseOrdersPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Stock Receiving - Staff and above */}
              <Route 
                path="receiving" 
                element={
                  <ProtectedRoute requiredRoles={[UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]}>
                    <ReceivingPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Analytics - Manager and above */}
              <Route 
                path="analytics" 
                element={
                  <ProtectedRoute requiredRoles={[UserRole.MANAGER, UserRole.ADMIN]}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Profile - Available to all authenticated users */}
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            
            {/* 404 Not Found */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;