import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// Logging helper
const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [DocProcessor] [${level}]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
};

// Extract raw text for Gemini analysis
export const extractTextFromDocx = async (file: File): Promise<string> => {
  const start = Date.now();
  log('INFO', `📄 Extracting text from ${file.name}`, { fileSize: file.size });
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    log('INFO', `✅ Text extracted from ${file.name}`, {
      extractedChars: result.value.length,
      timeMs: Date.now() - start
    });
    return result.value;
  } catch (e) {
    log('ERROR', `❌ Mammoth extraction failed for ${file.name}`, { error: String(e) });
    throw e;
  }
};

/**
 * Creates a NEW .docx file from plain text.
 * This ensures that anonymization is 100% applied as it doesn't rely on regex over complex XML.
 */
export const createDocxFromText = async (text: string): Promise<Blob> => {
    const start = Date.now();
    log('INFO', `📝 Creating new DOCX from processed text`, { inputChars: text.length });
    
    // Split by newlines to create paragraphs
    const lines = text.split(/\r?\n/);
    log('INFO', `📋 Document structure`, { totalLines: lines.length });
    
    const doc = new Document({
        sections: [{
            properties: {},
            children: lines.map(line => {
                return new Paragraph({
                    children: [
                        new TextRun({
                            text: line,
                            size: 24, // 12pt
                            font: "Times New Roman"
                        })
                    ],
                    spacing: {
                        after: 200,
                    }
                });
            })
        }]
    });

    const blob = await Packer.toBlob(doc);
    log('INFO', `✅ DOCX created`, { 
        blobSize: blob.size,
        timeMs: Date.now() - start 
    });
    return blob;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};