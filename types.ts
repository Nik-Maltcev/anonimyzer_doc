export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface DocFile {
  id: string;
  originalFile: File;
  status: ProcessingStatus;
  resultBlob?: Blob;
  error?: string;
  originalText?: string;
  processedText?: string;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export type SystemStatus = 'unknown' | 'checking' | 'online' | 'error';