import React from 'react';
import { StockStatus, ReorderRequestStatus, BudgetStatus, TestStatus } from '../../types';

interface StatusBadgeProps {
  status: StockStatus | ReorderRequestStatus | BudgetStatus | TestStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStyles = () => {
    switch (status) {
      // Positive states
      case 'Healthy':
      case 'Approved':
      case 'Verified':
      case 'Passed':
      case 'Normal':
        return {
          bg: 'bg-[#EBF7F0]',
          text: 'text-[#327456]',
          border: 'border-[#BCE8D3]',
          dot: 'bg-[#327456]',
        };

      // Caution / Warning states
      case 'Low Stock':
      case 'In Transit':
      case 'Needs Review':
      case 'Draft':
        return {
          bg: 'bg-[#FFF9EB]',
          text: 'text-[#8A5F00]',
          border: 'border-[#F4DEC0]',
          dot: 'bg-[#B7791F]',
        };

      // Marigold budget & price jump highlights (reserved)
      case 'Needs Budget Review':
      case 'Price Increase Review':
      case 'Price Jump Alert':
        return {
          bg: 'bg-[#FFF8E6]',
          text: 'text-[#8A5F00]',
          border: 'border-[#EAAA00]/40',
          dot: 'bg-[#EAAA00]',
        };

      // Deep Espresso / Soft Lavender highlights
      case 'Stockout Risk':
      case 'Delayed':
      case 'Running':
      case 'Under Review':
        return {
          bg: 'bg-[#E8E2F0]',
          text: 'text-[#46362F]',
          border: 'border-[#46362F]/20',
          dot: 'bg-[#46362F]',
        };

      // Danger / Critical states
      case 'Critical':
      case 'Out of Stock':
      case 'Rejected':
      case 'Failed':
      case 'Cancelled':
        return {
          bg: 'bg-[#FDF0F2]',
          text: 'text-[#B42335]',
          border: 'border-[#F8C8CE]',
          dot: 'bg-[#B42335]',
        };

      // Neutral / Inactive states
      case 'Ordered':
      case 'Pending Approval':
        return {
          bg: 'bg-[#F8F6F2]',
          text: 'text-[#46362F]',
          border: 'border-[#E7E0D8]',
          dot: 'bg-[#8A9A83]',
        };

      case 'Not Run':
      default:
        return {
          bg: 'bg-[#F8F6F2]',
          text: 'text-[#6B625B]',
          border: 'border-[#E7E0D8]',
          dot: 'bg-[#6B625B]',
        };
    }
  };

  const { bg, text, border, dot } = getStyles();
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded border ${bg} ${text} ${border} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="font-semibold tracking-tight">{status}</span>
    </span>
  );
};
