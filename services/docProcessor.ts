import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// Extract raw text for Gemini analysis
export const extractTextFromDocx = async (file: File): Promise<string> => {
  console.log(`[DocProcessor] Extracting text from ${file.name}`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (e) {
    console.error("[DocProcessor] Mammoth extraction failed:", e);
    throw e;
  }
};

/**
 * Creates a NEW .docx file from plain text.
 * This ensures that anonymization is 100% applied as it doesn't rely on regex over complex XML.
 */
export const createDocxFromText = async (text: string): Promise<Blob> => {
    console.log("[DocProcessor] Creating new DOCX from processed text...");
    
    // Split by newlines to create paragraphs
    const lines = text.split(/\r?\n/);
    
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

    return await Packer.toBlob(doc);
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