import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { Play, Trash2, DownloadCloud, FileText } from 'lucide-react';

import Header from './components/Header';
import FileUploader from './components/FileUploader';
import QueueItem from './components/QueueItem';
import Stats from './components/Stats';
import { DocFile, ProcessingStatus, ProcessingStats } from './types';
import { extractTextFromDocx, createDocxFromText, downloadBlob } from './services/docProcessor';
import { anonymizeDocumentText } from './services/geminiService';

const MAX_FILES = 100;

const App: React.FC = () => {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);

  // Statistics calculation
  const stats: ProcessingStats = {
    total: files.length,
    completed: files.filter(f => f.status === ProcessingStatus.COMPLETED).length,
    failed: files.filter(f => f.status === ProcessingStatus.ERROR).length,
    pending: files.filter(f => f.status === ProcessingStatus.PENDING).length,
  };

  // Add files to queue
  const handleFilesSelected = (newFiles: File[]) => {
    if (files.length + newFiles.length > MAX_FILES) {
      alert(`Лимит исчерпан. Вы можете обработать не более ${MAX_FILES} файлов.`);
      return;
    }

    const docFiles: DocFile[] = newFiles.map(file => ({
      id: uuidv4(),
      originalFile: file,
      status: ProcessingStatus.PENDING,
    }));

    setFiles(prev => [...prev, ...docFiles]);
  };

  // Process a single file using Reconstruction method
  const processFile = useCallback(async (file: DocFile) => {
    try {
      console.log(`Processing file: ${file.originalFile.name}`);
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: ProcessingStatus.PROCESSING } : f));

      // 1. Extract clean text
      const rawText = await extractTextFromDocx(file.originalFile);
      if (!rawText.trim()) throw new Error("Файл не содержит текста.");

      // 2. Anonymize the whole text via Gemini (Chunked internally)
      const anonymizedText = await anonymizeDocumentText(rawText);

      // 3. Create a NEW docx file from this text
      const resultBlob = await createDocxFromText(anonymizedText);

      // 4. Update Status
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          status: ProcessingStatus.COMPLETED, 
          resultBlob,
          originalText: rawText.substring(0, 100) + "...",
          processedText: "Документ полностью пересобран с обезличиванием"
        } : f
      ));

    } catch (error: any) {
      console.error(`Error processing ${file.originalFile.name}:`, error);
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          status: ProcessingStatus.ERROR, 
          error: error.message || "Ошибка обработки" 
        } : f
      ));
    }
  }, []);

  // Queue Processor
  useEffect(() => {
    if (!isProcessing || stopRequested) {
      setIsProcessing(false);
      return;
    }

    const isAnyProcessing = files.some(f => f.status === ProcessingStatus.PROCESSING);
    if (isAnyProcessing) return;

    const nextFile = files.find(f => f.status === ProcessingStatus.PENDING);

    if (nextFile) {
      const timer = setTimeout(() => {
          processFile(nextFile);
      }, 1000); 
      return () => clearTimeout(timer);
    } else {
      setIsProcessing(false);
    }
  }, [files, isProcessing, stopRequested, processFile]);

  const startProcessing = () => {
    setStopRequested(false);
    setIsProcessing(true);
  };

  const stopProcessing = () => {
    setStopRequested(true);
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setFiles([]);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    const completedFiles = files.filter(f => f.status === ProcessingStatus.COMPLETED && f.resultBlob);
    if (completedFiles.length === 0) return;

    completedFiles.forEach(file => {
      if (file.resultBlob) {
        zip.file(`anonymized_${file.originalFile.name}`, file.resultBlob);
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    downloadBlob(content, "obezlichennye_dokumenty.zip");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Info Banner */}
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800">
                <strong>Режим максимальной защиты:</strong> Документы пересобираются «с нуля». Это гарантирует 100% замену всех найденных имен, даже если они скрыты в сложных таблицах или тегах Word. Сложное форматирование (картинки, стили шрифтов) может быть упрощено.
              </p>
            </div>
          </div>
        </div>

        <Stats stats={stats} />

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex space-x-3">
             {!isProcessing ? (
               <button
                 onClick={startProcessing}
                 disabled={stats.pending === 0}
                 className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
               >
                 <Play className="h-4 w-4 mr-2" />
                 Начать обработку
               </button>
             ) : (
               <button
                 onClick={stopProcessing}
                 className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
               >
                 Стоп
               </button>
             )}
             
             <button
                onClick={clearQueue}
                disabled={isProcessing || files.length === 0}
                className="flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Очистить
              </button>
          </div>

          {stats.completed > 0 && (
             <button
              onClick={downloadAll}
              className="flex items-center px-4 py-2 border border-indigo-200 shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <DownloadCloud className="h-4 w-4 mr-2" />
              Скачать все (.zip)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
             <div className="sticky top-6">
                <FileUploader onFilesSelected={handleFilesSelected} disabled={isProcessing} />
                <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-sm text-gray-600 space-y-2">
                  <h4 className="font-semibold text-gray-900">Как это работает?</h4>
                  <p>1. Текст извлекается из вашего файла.</p>
                  <p>2. Gemini переписывает его, заменяя ПДн на теги [ФИО], [ТЕЛЕФОН] и т.д.</p>
                  <p>3. Создается новый DOCX файл с очищенным текстом.</p>
                </div>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {files.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                Загрузите документы для обработки.
              </div>
            ) : (
              files.map(file => (
                <QueueItem key={file.id} file={file} />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;