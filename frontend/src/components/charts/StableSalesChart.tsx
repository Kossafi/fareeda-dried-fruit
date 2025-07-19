import React, { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import LoadingSpinner from '@components/common/LoadingSpinner';

interface SalesData {
  date: string;
  sales: number;
  quantity: number;
}

interface StableSalesChartProps {
  data: SalesData[];
  containerWidth?: number;
  height?: number;
}

const StableSalesChart: React.FC<StableSalesChartProps> = ({ 
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
          formattedDate: format(parseISO(item.date), 'dd MMM', { locale: th }),
          fullDate: format(parseISO(item.date), 'dd MMMM yyyy', { locale: th })
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
          <p className="text-sm font-medium text-gray-900 mb-2">{data.fullDate}</p>
          <div className="space-y-1">
            <p className="text-sm text-primary-600">
              <span className="inline-block w-3 h-3 bg-primary-600 rounded-full mr-2"></span>
              ยอดขาย: {payload[0].value} รายการ
            </p>
            <p className="text-sm text-success-600">
              <span className="inline-block w-3 h-3 bg-success-600 rounded-full mr-2"></span>
              น้ำหนัก: {payload[1].value.toLocaleString()} กรัม
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
        <LoadingSpinner size="medium" message="กำลังโหลดกราฟ..." />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
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
        <LineChart
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
            vertical={false}
          />
          <XAxis 
            dataKey="formattedDate"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            yAxisId="sales"
            orientation="left"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ 
              value: 'รายการ', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
            }}
          />
          <YAxis 
            yAxisId="quantity"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ 
              value: 'กรัม', 
              angle: 90, 
              position: 'insideRight',
              style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
            }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '5 5' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
            iconType="line"
          />
          <Line 
            yAxisId="sales"
            type="monotone" 
            dataKey="sales" 
            stroke="#f59e0b" 
            strokeWidth={3}
            dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2, fill: '#fff' }}
            name="ยอดขาย (รายการ)"
          />
          <Line 
            yAxisId="quantity"
            type="monotone" 
            dataKey="quantity" 
            stroke="#22c55e" 
            strokeWidth={3}
            dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2, fill: '#fff' }}
            name="น้ำหนัก (กรัม)"
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StableSalesChart;