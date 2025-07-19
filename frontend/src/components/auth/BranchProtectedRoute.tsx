import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import BranchSelectionPage from '@pages/auth/BranchSelectionPage';
import LoadingSpinner from '@components/common/LoadingSpinner';

interface BranchProtectedRouteProps {
  children: React.ReactNode;
}

const BranchProtectedRoute: React.FC<BranchProtectedRouteProps> = ({ children }) => {
  const { 
    isAuthenticated, 
    loading, 
    needsBranchSelection, 
    dailySession,
    user 
  } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <LoadingSpinner size="large" message="กำลังตรวจสอบสิทธิ์..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Show branch selection if needed
  if (needsBranchSelection || !dailySession) {
    return <BranchSelectionPage />;
  }

  // Render protected content if user has selected branch
  return <>{children}</>;
};

export default BranchProtectedRoute;