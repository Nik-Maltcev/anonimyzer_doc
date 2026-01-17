import React, { useState } from 'react';
import { ShieldCheck, Activity, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { testSystem } from '../services/geminiService';
import { SystemStatus } from '../types';

const Header: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>('unknown');

  const checkSystem = async () => {
    setStatus('checking');
    const result = await testSystem();
    setStatus(result ? 'online' : 'error');
    
    if (!result) {
        alert("Ошибка: Не удалось подключиться к Gemini API. Проверьте консоль для деталей.");
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">DocAnonymizer AI</h1>
                <p className="text-xs text-gray-500">Массовое обезличивание документов</p>
            </div>
            </div>

            <div className="flex items-center space-x-3">
                <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-purple-50 rounded-full border border-purple-100">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">Model: Gemini 3.0 Pro</span>
                </div>

                <button 
                    onClick={checkSystem}
                    disabled={status === 'checking'}
                    className="flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Проверить работу AI"
                >
                    {status === 'checking' && <Activity className="h-3 w-3 animate-spin text-indigo-500" />}
                    {status === 'online' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                    {status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                    {status === 'unknown' && <Activity className="h-3 w-3 text-gray-400" />}
                    
                    <span className="font-medium text-gray-600">
                        {status === 'checking' ? 'Проверка...' : 
                         status === 'online' ? 'Система OK' : 
                         status === 'error' ? 'Ошибка AI' : 'Статус'}
                    </span>
                </button>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;