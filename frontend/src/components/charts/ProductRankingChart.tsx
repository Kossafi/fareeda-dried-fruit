import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import LoadingSpinner from '@components/common/LoadingSpinner';

interface ProductRankingData {
  rank: number;
  productName: string;
  totalQuantitySold: number;
  totalTransactions: number;
}

interface ProductRankingChartProps {
  data: ProductRankingData[];
  containerWidth?: number;
  height?: number;
}

const ProductRankingChart: React.FC<ProductRankingChartProps> = ({ 
  data = [], 
  containerWidth = 600,
  height = 300 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: containerWidth, height });
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  // Colors for different ranking positions
  const rankingColors = [
    '#f59e0b', // Gold for #1
    '#e5e7eb', // Silver for #2  
    '#cd7c2f', // Bronze for #3
    '#6b7280', // Gray for #4
    '#9ca3af'  // Light gray for #5+
  ];

  // Process and format data
  useEffect(() => {
    if (data && data.length > 0) {
      setIsLoading(true);
      
      // Simulate processing time to prevent chart distortion
      const timer = setTimeout(() => {
        const processedData = data.map((item, index) => ({
          ...item,
          shortName: item.productName.length > 8 ? 
            item.productName.substring(0, 8) + '...' : 
            item.productName,
          color: rankingColors[index] || '#9ca3af',
          medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`,
          avgPerTransaction: Math.round(item.totalQuantitySold / item.totalTransactions)
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
          width: Math.max(400, rect.width - 20), // Minimum width with padding
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
          <div className="flex items-center mb-2">
            <span className="text-lg mr-2">{data.medal}</span>
            <p className="text-sm font-medium text-gray-900">{data.productName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-primary-600">
              น้ำหนักรวม: {payload[0].value.toLocaleString()} กรัม
            </p>
            <p className="text-sm text-gray-600">
              จำนวนรายการ: {data.totalTransactions.toLocaleString()} รายการ
            </p>
            <p className="text-sm text-gray-600">
              เฉลี่ยต่อรายการ: {data.avgPerTransaction.toLocaleString()} กรัม
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
        <LoadingSpinner size="medium" message="กำลังโหลดอันดับสินค้า..." />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="text-sm">ไม่มีข้อมูลอันดับสินค้า</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartRef} 
      className="w-full h-full"
      style={{ minHeight: '250px', minWidth: '400px' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="horizontal"
          margin={{
            top: 20,
            right: 30,
            left: 80,
            bottom: 20,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#f0f0f0"
            horizontal={false}
            vertical={true}
          />
          <XAxis 
            type="number"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
          />
          <YAxis 
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            width={70}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }}
          />
          <Bar 
            dataKey="totalQuantitySold"
            radius={[0, 4, 4, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Ranking Legend */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {chartData.slice(0, 3).map((item, index) => (
          <div key={item.rank} className="flex items-center text-xs text-gray-600">
            <span className="mr-1">{item.medal}</span>
            <span className="truncate max-w-20">{item.productName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductRankingChart;