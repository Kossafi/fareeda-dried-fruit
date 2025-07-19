import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocket } from '@contexts/SocketContext';
import {
  ChartBarIcon,
  ClockIcon,
  TrendingUpIcon,
  CalendarIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '@components/common/LoadingSpinner';
import StableSalesChart from '@components/charts/StableSalesChart';
import HourlyPatternChart from '@components/charts/HourlyPatternChart';
import ProductRankingChart from '@components/charts/ProductRankingChart';
import StockLevelGauge from '@components/charts/StockLevelGauge';
import toast from 'react-hot-toast';
import apiClient from '@services/api';

const AnalyticsPage: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const { connected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState('7days');
  const [analytics, setAnalytics] = useState<any>(null);
  const [chartData, setChartData] = useState<any>({
    dailySales: [],
    hourlyPattern: [],
    productRanking: [],
    stockLevels: []
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // Measure container dimensions for responsive charts
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    // Initial measurement
    measureContainer();

    // Add resize listener
    const resizeObserver = new ResizeObserver(measureContainer);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedDateRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Mock data with realistic patterns
      const mockAnalytics = {
        overview: {
          totalSales: 347,
          totalQuantitySold: 15420,
          averageQuantityPerSale: 44.4,
          averageSalesPerDay: 49.6
        },
        patterns: {
          peakHour: 14,
          peakDay: 6,
          bestPerformingTimeSlot: '14:00-15:00'
        },
        trends: {
          growthRate: '+12.5%',
          seasonality: 'High',
          consistency: 85
        }
      };

      const mockChartData = {
        // Daily sales data (past 7 days)
        dailySales: [
          { date: '2024-01-15', sales: 42, quantity: 1850 },
          { date: '2024-01-16', sales: 38, quantity: 1620 },
          { date: '2024-01-17', sales: 51, quantity: 2180 },
          { date: '2024-01-18', sales: 45, quantity: 1920 },
          { date: '2024-01-19', sales: 58, quantity: 2450 },
          { date: '2024-01-20', sales: 62, quantity: 2630 },
          { date: '2024-01-21', sales: 51, quantity: 2170 }
        ],
        
        // Hourly pattern (24 hours)
        hourlyPattern: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          quantitySold: Math.floor(Math.random() * 200) + 50,
          transactionCount: Math.floor(Math.random() * 15) + 2
        })).map(item => {
          // Peak hours simulation (11-15 and 18-20)
          if ((item.hour >= 11 && item.hour <= 15) || (item.hour >= 18 && item.hour <= 20)) {
            return {
              ...item,
              quantitySold: item.quantitySold * 2.5,
              transactionCount: item.transactionCount * 2
            };
          }
          // Low hours (22-8)
          if (item.hour >= 22 || item.hour <= 8) {
            return {
              ...item,
              quantitySold: Math.floor(item.quantitySold * 0.3),
              transactionCount: Math.floor(item.transactionCount * 0.4)
            };
          }
          return item;
        }),
        
        // Product ranking
        productRanking: [
          { rank: 1, productName: 'อัลมอนด์อ่อน', totalQuantitySold: 3250, totalTransactions: 145 },
          { rank: 2, productName: 'ลูกเกดอ่อน', totalQuantitySold: 2850, totalTransactions: 128 },
          { rank: 3, productName: 'มะม่วงอ่อน', totalQuantitySold: 2140, totalTransactions: 98 },
          { rank: 4, productName: 'องุ่นอ่อน', totalQuantitySold: 1890, totalTransactions: 87 },
          { rank: 5, productName: 'มะทีี่นับชิ้น', totalQuantitySold: 156, totalTransactions: 52 }
        ],
        
        // Stock levels for gauge charts
        stockLevels: [
          { productName: 'อัลมอนด์อ่อน', current: 2500, threshold: 1000, max: 5000 },
          { productName: 'ลูกเกดอ่อน', current: 800, threshold: 1000, max: 3000 },
          { productName: 'มะม่วงอ่อน', current: 0, threshold: 500, max: 2500 },
          { productName: 'องุ่นอ่อน', current: 1200, threshold: 800, max: 2000 }
        ]
      };
      
      setAnalytics(mockAnalytics);
      setChartData(mockChartData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('ไม่สามารถโหลดข้อมูลวิเคราะห์ได้');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" message="กำลังโหลดข้อมูลวิเคราะห์..." />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ChartBarIcon className="h-8 w-8 mr-3 text-primary-600" />
            รายงานและวิเคราะห์ (เน้นน้ำหนัก)
          </h1>
          <p className="text-gray-600 mt-1">
            วิเคราะห์ข้อมูลการขายและแนวโน้มตามน้ำหนัก/จำนวนสินค้า
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Date Range Selector */}
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="form-select"
          >
            <option value="7days">7 วันที่ผ่านมา</option>
            <option value="30days">30 วันที่ผ่านมา</option>
            <option value="90days">90 วันที่ผ่านมา</option>
          </select>
          
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            connected 
              ? 'bg-success-100 text-success-800' 
              : 'bg-danger-100 text-danger-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-success-500' : 'bg-danger-500'
            }`} />
            <span>{connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}</span>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">ยอดขายรวม</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalSales}</p>
                  <p className="text-xs text-gray-500">รายการ</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                    <TrendingUpIcon className="w-5 h-5 text-success-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">น้ำหนักรวม</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalQuantitySold.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">กรัม</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-5 h-5 text-warning-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">ช่วงเวลาขายดี</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.patterns.peakHour}:00</p>
                  <p className="text-xs text-gray-500">น.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUpIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">อัตราเติบโต</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.trends.growthRate}</p>
                  <p className="text-xs text-gray-500">เทียบเดือนก่อน</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">ยอดขายรายวัน (น้ำหนัก)</h3>
            <p className="text-sm text-gray-500">กราฟแสดงน้ำหนักสินค้าที่ขายได้ในแต่ละวัน</p>
          </div>
          <div className="card-body">
            <div className="h-80">
              <StableSalesChart 
                data={chartData.dailySales}
                containerWidth={containerDimensions.width > 0 ? (containerDimensions.width - 48) / 2 - 24 : 400}
              />
            </div>
          </div>
        </div>

        {/* Hourly Pattern Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">รูปแบบการขายรายชั่วโมง</h3>
            <p className="text-sm text-gray-500">กราฟแสดงช่วงเวลาที่ขายสินค้าได้มากที่สุด</p>
          </div>
          <div className="card-body">
            <div className="h-80">
              <HourlyPatternChart 
                data={chartData.hourlyPattern}
                containerWidth={containerDimensions.width > 0 ? (containerDimensions.width - 48) / 2 - 24 : 400}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Product Ranking and Stock Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Ranking */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">อันดับสินค้าขายดี (ตามน้ำหนัก)</h3>
            <p className="text-sm text-gray-500">เรียงลำดับสินค้าตามน้ำหนักที่ขายได้</p>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ProductRankingChart 
                data={chartData.productRanking}
                containerWidth={containerDimensions.width > 0 ? ((containerDimensions.width - 48) * 2 / 3) - 24 : 600}
              />
            </div>
          </div>
        </div>

        {/* Stock Level Gauges */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">ระดับสต๊อคสินค้า</h3>
            <p className="text-sm text-gray-500">แสดงระดับสต๊อคเทียบกับเกณฑ์</p>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {chartData.stockLevels.slice(0, 4).map((stock: any, index: number) => (
                <StockLevelGauge
                  key={index}
                  data={stock}
                  containerWidth={containerDimensions.width > 0 ? (containerDimensions.width - 48) / 3 - 24 : 300}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      {analytics && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">ข้อมูลเชิงลึก</h3>
            <p className="text-sm text-gray-500">สรุปแนวโน้มและข้อเสนอแนะ</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">
                  {analytics.overview.averageQuantityPerSale}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">
                  น้ำหนักเฉลี่ยต่อรายการ
                </div>
                <div className="text-xs text-gray-500">
                  กรัมต่อการขาย 1 รายการ
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-success-600 mb-2">
                  {analytics.patterns.bestPerformingTimeSlot}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">
                  ช่วงเวลาขายดีที่สุด
                </div>
                <div className="text-xs text-gray-500">
                  ช่วงที่ลูกค้ามากที่สุด
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-warning-600 mb-2">
                  {analytics.trends.consistency}%
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">
                  ความสม่ำเสมอ
                </div>
                <div className="text-xs text-gray-500">
                  ความสม่ำเสมอของยอดขาย
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;