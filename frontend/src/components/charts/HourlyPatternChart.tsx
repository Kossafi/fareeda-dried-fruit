import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '@components/common/LoadingSpinner';

interface HourlyData {
  hour: number;
  quantitySold: number;
  transactionCount: number;
}

interface HourlyPatternChartProps {
  data: HourlyData[];
  containerWidth?: number;
  height?: number;
}

const HourlyPatternChart: React.FC<HourlyPatternChartProps> = ({ 
  data = [], 
  containerWidth = 400,
  height = 300 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: containerWidth, height });
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  // Process and format data
  useEffect(() => {
    if (data && data.length > 0) {
      setIsLoading(true);
      
      // Simulate processing time to prevent chart distortion
      const timer = setTimeout(() => {
        const processedData = data.map(item => ({
          ...item,
          hourDisplay: `${item.hour.toString().padStart(2, '0')}:00`,
          period: item.hour < 12 ? 'AM' : 'PM',
          displayHour: item.hour === 0 ? 12 : item.hour > 12 ? item.hour - 12 : item.hour
        }));
        
        setChartData(processedData);
        setIsLoading(false);
      }, 100);
      
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
          width: Math.max(300, rect.width - 20), // Minimum width with padding
          height: Math.max(250, height)
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">เวลา {data.hourDisplay}</p>
          <div className="space-y-1">
            <p className="text-sm text-primary-600">
              <span className="inline-block w-3 h-3 bg-primary-600 rounded-full mr-2"></span>
              น้ำหนักขาย: {payload[0].value.toLocaleString()} กรัม
            </p>
            <p className="text-sm text-success-600">
              <span className="inline-block w-3 h-3 bg-success-600 rounded-full mr-2"></span>
              จำนวนรายการ: {payload[1].value} รายการ
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="medium" message="กำลังโหลดกราฟรูปแบบชั่วโมง..." />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🕐</div>
          <p className="text-sm">ไม่มีข้อมูลรูปแบบการขายรายชั่วโมง</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartRef} 
      className="w-full h-full"
      style={{ minHeight: '250px', minWidth: '300px' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#f0f0f0"
            horizontal={true}
            vertical={false}
          />
          <XAxis 
            dataKey="hourDisplay"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            interval={2} // Show every 3rd hour to avoid crowding
          />
          <YAxis 
            yAxisId="quantity"
            orientation="left"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ 
              value: 'กรัม', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
            }}
          />
          <YAxis 
            yAxisId="transactions"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ 
              value: 'รายการ', 
              angle: 90, 
              position: 'insideRight',
              style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
            }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
            iconType="rect"
          />
          <Bar 
            yAxisId="quantity"
            dataKey="quantitySold" 
            fill="#f59e0b" 
            name="น้ำหนักขาย (กรัม)"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            yAxisId="transactions"
            dataKey="transactionCount" 
            fill="#22c55e" 
            name="จำนวนรายการ"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HourlyPatternChart;