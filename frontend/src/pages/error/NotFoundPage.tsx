import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* 404 Icon */}
          <div className="mx-auto h-32 w-32 bg-gray-100 rounded-full flex items-center justify-center mb-8">
            <span className="text-6xl font-bold text-gray-400">404</span>
          </div>
          
          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            ไม่พบหน้าที่คุณต้องการ
          </h1>
          
          <p className="text-gray-600 mb-8">
            ขออภัย หน้าที่คุณกำลังมองหาไม่มีอยู่ หรืออาจถูกย้ายไปแล้ว<br />
            กรุณาตรวจสอบ URL หรือลองกลับไปยังหน้าหลัก
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="btn btn-outline inline-flex items-center"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              กลับไปหน้าก่อน
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary inline-flex items-center"
            >
              <HomeIcon className="h-5 w-5 mr-2" />
              กลับสู่หน้าหลัก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;