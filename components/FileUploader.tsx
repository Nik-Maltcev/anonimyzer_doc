import React, { useRef } from 'react';
import { UploadCloud, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    // Explicitly cast to File[] and restrict to .docx only (Mammoth limitation)
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(
      file => file.name.endsWith('.docx')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;
    // Fix: Explicitly cast Array.from result to File[] to fix 'Property name does not exist on type unknown' error
    const files = (Array.from(e.target.files) as File[]).filter(file => file.name.endsWith('.docx'));
    onFilesSelected(files);
    // Reset input so same files can be selected again if needed (though usually we clear)
    e.target.value = '';
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative group border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer
        ${disabled 
          ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60' 
          : 'border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-500'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".docx"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${disabled ? 'bg-gray-100' : 'bg-indigo-100 group-hover:scale-110 transition-transform'}`}>
          <UploadCloud className={`h-8 w-8 ${disabled ? 'text-gray-400' : 'text-indigo-600'}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {disabled ? 'Идет обработка...' : 'Загрузить файлы'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Перетащите файлы .docx сюда или нажмите для выбора
          </p>
          <p className="text-xs text-indigo-500 font-medium mt-2">
            Максимум 100 файлов
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Обезличивает ФИО, адреса, паспорта и др.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;