import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  trend?: string;
  trendType?: 'positive' | 'warning' | 'danger' | 'neutral' | 'marigold';
  sparklineData?: number[];
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  description,
  trend,
  trendType = 'neutral',
  sparklineData,
  onClick,
}) => {
  const getTrendStyle = () => {
    switch (trendType) {
      case 'positive':
        return 'text-[#327456] bg-[#EBF7F0] border border-[#BCE8D3]';
      case 'warning':
        return 'text-[#B7791F] bg-[#FFF9EB] border border-[#F4DEC0]';
      case 'marigold':
        return 'text-[#8A5F00] bg-[#FFF8E6] border border-[#EAAA00]/40 font-bold';
      case 'danger':
        return 'text-[#B42335] bg-[#FDF0F2] border border-[#F8C8CE]';
      case 'neutral':
      default:
        return 'text-[#46362F] bg-[#F8F6F2] border border-[#E7E0D8]';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`p-4 bg-white border border-[#E7E0D8] rounded-2xl transition-all shadow-xs hover:shadow-sm group ${
        onClick ? 'cursor-pointer hover:border-[#46362F]/40 hover:bg-[#F8F6F2]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[#6B625B] tracking-wide">{label}</span>
        <div className="p-2 rounded-lg bg-[#E8E2F0] text-[#46362F] group-hover:bg-[#46362F] group-hover:text-white transition-colors">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold tracking-tight text-[#46362F]">
          {value}
        </span>
        {trend && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getTrendStyle()}`}>
            {trend}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[#6B625B] leading-relaxed line-clamp-1">
        {description}
      </p>

      {/* Subtle miniature visual progress/sparkline bar */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 flex items-end gap-1 h-2.5 pt-1">
          {sparklineData.map((val, idx) => (
            <div 
              key={idx}
              className="flex-1 bg-[#E7E0D8] hover:bg-[#46362F] rounded-xs transition-colors"
              style={{ height: `${Math.min(100, Math.max(25, val * 9))}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
