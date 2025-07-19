import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { LoginRequest } from '@types/index';
import {
  EyeIcon,
  EyeSlashIcon,
  CubeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@components/common/LoadingSpinner';
import DemoAccountSelector from '@components/auth/DemoAccountSelector';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, loading, error, clearError } = useAuth();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);
  
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginRequest>({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Focus on username field when component mounts
  useEffect(() => {
    setFocus('username');
  }, [setFocus]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginRequest) => {
    try {
      setIsSubmitting(true);
      clearError();
      await login(data);
      // Navigation will happen automatically via AuthContext
    } catch (error) {
      // Error handling is done in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccountSelect = async (username: string, password: string) => {
    try {
      setIsSubmitting(true);
      clearError();
      await login({ username, password });
    } catch (error) {
      // Error handling is done in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <LoadingSpinner size="large" message="กำลังโหลดระบบ..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <CubeIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            ระบบจัดการสต๊อคผลไม้อบแห้ง
          </p>
        </div>

        {/* Login Options Toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            onClick={() => setShowDemoSelector(false)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              !showDemoSelector
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ล็อกอินแบบปกติ
          </button>
          <button
            onClick={() => setShowDemoSelector(true)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              showDemoSelector
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🎭 Demo Accounts
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-strong p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-danger-50 border border-danger-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-danger-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-danger-800">
                    เกิดข้อผิดพลาด
                  </h3>
                  <p className="mt-1 text-sm text-danger-700">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Rendering: Demo Selector or Regular Form */}
          {showDemoSelector ? (
            <DemoAccountSelector
              onAccountSelect={handleDemoAccountSelect}
              loading={isSubmitting}
            />
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="form-label">
                ชื่อผู้ใช้
              </label>
              <div className="mt-1">
                <input
                  {...register('username', {
                    required: 'กรุณากรอกชื่อผู้ใช้',
                    minLength: {
                      value: 3,
                      message: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'
                    }
                  })}
                  type="text"
                  id="username"
                  autoComplete="username"
                  className="form-input"
                  placeholder="กรอกชื่อผู้ใช้"
                  disabled={isSubmitting}
                />
                {errors.username && (
                  <p className="form-error mt-1">{errors.username.message}</p>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                รหัสผ่าน
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password', {
                    required: 'กรุณากรอกรหัสผ่าน',
                    minLength: {
                      value: 6,
                      message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  className="form-input pr-10"
                  placeholder="กรอกรหัสผ่าน"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
                {errors.password && (
                  <p className="form-error mt-1">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="small" color="white" className="mr-2" />
                    กำลังเข้าสู่ระบบ...
                  </div>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </button>
            </div>
          </form>
          )}

          {/* Demo Credentials - Only show for regular login */}
          {!showDemoSelector && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">
                ข้อมูลเข้าสู่ระบบทดลอง:
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <strong>ผู้ดูแลระบบ:</strong> admin / admin123
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <strong>ผู้จัดการ:</strong> manager / manager123
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <strong>พนักงาน:</strong> staff / staff123
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>
            &copy; 2024 Dried Fruit Management System. สงวนสิทธิ์ทั้งหมด.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;