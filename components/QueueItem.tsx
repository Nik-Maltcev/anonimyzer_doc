import React from 'react';
import { FileText, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { DocFile, ProcessingStatus } from '../types';
import { downloadBlob } from '../services/docProcessor';

interface QueueItemProps {
  file: DocFile;
}

const QueueItem: React.FC<QueueItemProps> = ({ file }) => {
  const handleDownload = () => {
    if (file.resultBlob) {
      downloadBlob(file.resultBlob, `anonymized_${file.originalFile.name}`);
    }
  };

  const getStatusIcon = () => {
    switch (file.status) {
      case ProcessingStatus.COMPLETED:
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case ProcessingStatus.ERROR:
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case ProcessingStatus.PROCESSING:
        return <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />;
      default:
        return <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-4 overflow-hidden">
        <div className={`p-2 rounded-lg ${
          file.status === ProcessingStatus.COMPLETED ? 'bg-emerald-50' : 
          file.status === ProcessingStatus.ERROR ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <FileText className={`h-5 w-5 ${
            file.status === ProcessingStatus.COMPLETED ? 'text-emerald-600' : 
            file.status === ProcessingStatus.ERROR ? 'text-red-600' : 'text-gray-500'
          }`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate" title={file.originalFile.name}>
            {file.originalFile.name}
          </p>
          <p className="text-xs text-gray-500">
            {(file.originalFile.size / 1024).toFixed(1)} KB
            {file.status === ProcessingStatus.ERROR && (
               <span className="text-red-500 ml-2">Ошибка: {file.error}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 ml-4">
        {getStatusIcon()}
        
        {file.status === ProcessingStatus.COMPLETED && (
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Скачать обработанный файл"
          >
            <Download className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default QueueItem;