import React from 'react';
import { StatCardProps } from '../types';

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, inverseTrend }) => {
  
  const getTrendColor = () => {
    if (!trend) return 'text-slate-600';
    if (trend.value > 0) return inverseTrend ? 'text-rose-600' : 'text-emerald-600';
    if (trend.value < 0) return inverseTrend ? 'text-emerald-600' : 'text-rose-600';
    return 'text-slate-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        </div>
        <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-medium ${getTrendColor()}`}>
            {trend.value > 0 ? '+' : ''}{trend.value}
          </span>
          <span className="text-slate-500 ml-2">{trend.label}</span>
        </div>
      )}
    </div>
  );
};