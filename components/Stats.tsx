import React from 'react';
import { ProcessingStats } from '../types';

interface StatsProps {
  stats: ProcessingStats;
}

const Stats: React.FC<StatsProps> = ({ stats }) => {
  const progress = stats.total > 0 ? ((stats.completed + stats.failed) / stats.total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500 font-medium">Всего файлов</p>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
      </div>
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500 font-medium">В ожидании</p>
        <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
      </div>
       <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500 font-medium">Готово</p>
        <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
      </div>
       <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500 font-medium">Ошибки</p>
        <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
      </div>
      
      {/* Progress Bar */}
      <div className="col-span-2 md:col-span-4 mt-2">
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Stats;