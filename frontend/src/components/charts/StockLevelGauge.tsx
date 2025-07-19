import React, { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '@components/common/LoadingSpinner';
import clsx from 'clsx';

interface StockLevelData {
  productName: string;
  current: number;
  threshold: number;
  max: number;
}

interface StockLevelGaugeProps {
  data: StockLevelData;
  containerWidth?: number;
  height?: number;
}

const StockLevelGauge: React.FC<StockLevelGaugeProps> = ({ 
  data,
  containerWidth = 300,
  height = 120 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: containerWidth, height });
  const [isLoading, setIsLoading] = useState(true);
  const [gaugeData, setGaugeData] = useState<any>(null);

  // Process and format data
  useEffect(() => {
    if (data) {
      setIsLoading(true);
      
      // Simulate processing time to prevent chart distortion
      const timer = setTimeout(() => {
        const percentage = Math.min(100, (data.current / data.max) * 100);
        const isLow = data.current <= data.threshold;
        const isEmpty = data.current === 0;
        
        // Create gauge data for pie chart
        const processedData = [
          { name: 'used', value: percentage, color: isEmpty ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e' },
          { name: 'remaining', value: 100 - percentage, color: '#f3f4f6' }
        ];
        
        setGaugeData({
          ...data,
          percentage: Math.round(percentage),
          isLow,
          isEmpty,
          status: isEmpty ? 'out' : isLow ? 'low' : 'normal',
          statusText: isEmpty ? 'หมดสต๊อค' : isLow ? 'ใกล้หมด' : 'ปกติ',
          chartData: processedData
        });
        setIsLoading(false);
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [data]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        setChartDimensions({
          width: Math.max(200, rect.width - 10), // Minimum width with padding
          height: Math.max(100, height)
        });
      }
    };

    // Initial measurement
    setTimeout(handleResize, 100);

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [height, containerWidth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <LoadingSpinner size="small" message="โหลด..." />
      </div>
    );
  }

  if (!gaugeData) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-1">📊</div>
          <p className="text-xs">ไม่มีข้อมูล</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartRef} 
      className="w-full"
      style={{ minHeight: '100px', minWidth: '200px' }}
    >
      <div className="flex items-center space-x-3">
        {/* Gauge Chart */}
        <div className="flex-shrink-0" style={{ width: '80px', height: '80px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData.chartData}
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={25}
                outerRadius={35}
                paddingAngle={0}
                dataKey="value"
              >
                {gaugeData.chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Text */}
          <div className="relative -mt-20 flex items-center justify-center h-20">
            <div className="text-center">
              <div className={clsx(
                "text-lg font-bold",
                gaugeData.isEmpty ? "text-danger-600" : 
                gaugeData.isLow ? "text-warning-600" : "text-success-600"
              )}>
                {gaugeData.percentage}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
            {gaugeData.productName}
          </h4>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">ปัจจุบัน:</span>
              <span className="font-medium">{gaugeData.current.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">เกณฑ์:</span>
              <span className="text-warning-600">{gaugeData.threshold.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">สูงสุด:</span>
              <span className="text-gray-500">{gaugeData.max.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="mt-2">
            <span className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
              gaugeData.isEmpty ? "bg-danger-100 text-danger-800" :
              gaugeData.isLow ? "bg-warning-100 text-warning-800" :
              "bg-success-100 text-success-800"
            )}>
              {gaugeData.statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockLevelGauge;