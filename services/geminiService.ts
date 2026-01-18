import { GoogleGenAI } from "@google/genai";

// Enhanced logging helper
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [Gemini] [${level}]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
};

// Performance timer helper
const createTimer = (label: string) => {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    log: (message?: string) => {
      const elapsed = Date.now() - start;
      log('INFO', `⏱️ ${label}: ${elapsed}ms ${message || ''}`);
      return elapsed;
    }
  };
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    log('ERROR', "API Key is missing!");
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Utility for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Splits text by paragraphs and groups them into chunks of roughly targetSize.
 * This is better than character-based chunking because it preserves sentences.
 */
function chunkByParagraphs(text: string, targetSize: number = 8000): string[] {
    const paragraphs = text.split(/\r?\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
        if ((currentChunk.length + para.length) > targetSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        currentChunk += para + "\n";
    }
    
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

/**
 * Wrapper for API calls with Retry logic
 */
async function generateWithRetry(callApi: () => Promise<any>, retries = 5, delayBase = 2000): Promise<any> {
    for (let i = 0; i < retries; i++) {
        const timer = createTimer(`API call attempt ${i + 1}`);
        try {
            const result = await callApi();
            timer.log('✅ Success');
            return result;
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429 || error.toString().includes('Too Many Requests');
            const errorInfo = {
                attempt: i + 1,
                isRateLimit,
                message: error.message,
                status: error.status
            };
            
            if (isRateLimit && i < retries - 1) {
                const waitTime = delayBase * Math.pow(2, i);
                log('WARN', `🚫 Rate limit hit, waiting ${waitTime}ms...`, errorInfo);
                await delay(waitTime);
                continue;
            }
            log('ERROR', `❌ API call failed`, errorInfo);
            throw error;
        }
    }
}

/**
 * Asks Gemini to redact a specific block of text and return the REDACTED TEXT.
 */
async function redactTextBlock(textBlock: string, index: number, total: number): Promise<string> {
    const timer = createTimer(`Chunk ${index + 1}/${total}`);
    log('INFO', `📝 Processing chunk ${index + 1}/${total}`, {
        chunkLength: textBlock.length,
        preview: textBlock.substring(0, 100) + '...'
    });
    
    const ai = getClient();

    const systemPrompt = `Ты — строгий эксперт по защите персональных данных (ПДн) в соответствии с 152-ФЗ.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА: Переписать входящий текст, заменив АБСОЛЮТНО ВСЕ персональные данные на теги.

ОБЯЗАТЕЛЬНЫЕ ЗАМЕНЫ (будь АГРЕССИВЕН в поиске):

1. ИМЕНА И ФИО -> [ФИО]
   - Полные ФИО: "Иванов Иван Иванович" -> [ФИО]
   - Частичные: "Иванов И.И.", "И.И. Иванов", "Иван Иванов" -> [ФИО]
   - Только имя: "Иван", "Мария", "Александр" -> [ФИО]
   - Только фамилия: "Иванов", "Петрова" -> [ФИО]
   - Инициалы: "И.И.", "А.С." -> [ФИО]
   - В подписях: "Директор Иванов", "Подпись: Петров" -> Директор [ФИО], Подпись: [ФИО]
   - Склонённые формы: "Иванову", "Петровой", "Сидоровым" -> [ФИО]
   - Иностранные имена: "John Smith", "Maria Garcia" -> [ФИО]

2. ТЕЛЕФОНЫ -> [ТЕЛЕФОН]
   - Любые форматы: +7, 8, (495), мобильные, городские
   - Примеры: "+7 (999) 123-45-67", "89991234567", "8-999-123-45-67"

3. EMAIL -> [EMAIL]
   - Любые email адреса: example@mail.ru, test@company.com

4. АДРЕСА -> [АДРЕС]
   - Полные адреса с городом, улицей, домом
   - Частичные: "ул. Ленина, д. 5", "г. Москва"
   - Индексы: "123456"

5. ДОКУМЕНТЫ -> [ДОКУМЕНТ]
   - Паспорт: серия, номер, кем выдан, код подразделения
   - ИНН (10 или 12 цифр)
   - СНИЛС (XXX-XXX-XXX XX)
   - ОГРН, ОГРНИП, КПП
   - Номера договоров с датами
   - Водительские удостоверения

6. ДАТЫ РОЖДЕНИЯ -> [ДАТА_РОЖДЕНИЯ]
   - "01.01.1990", "1 января 1990 г.", "родился 01.01.1990"

7. ФИНАНСОВЫЕ ДАННЫЕ -> [ФИНАНСЫ]
   - Номера банковских карт (16 цифр)
   - Расчётные счета (20 цифр)
   - БИК, корр. счета

КРИТИЧЕСКИ ВАЖНО:
- Возвращай ТОЛЬКО обработанный текст, без комментариев и пояснений
- Сохраняй ВСЮ структуру и форматирование оригинала
- НЕ пропускай ни одного имени — лучше перестраховаться
- Если слово ПОХОЖЕ на имя/фамилию — заменяй на [ФИО]
- Обрабатывай ВСЕ падежные формы имён
- НЕ добавляй текст от себя, только замены`;

    const response = await generateWithRetry(async () => {
        return ai.models.generateContent({
            model: "gemini-3-pro-preview",
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.05,
            },
            contents: textBlock
        });
    });

    const resultText = response.text || "";
    
    // Fallback: if response is empty or too short, return original chunk
    if (!resultText || resultText.length < textBlock.length * 0.3) {
        log('WARN', `⚠️ Empty or too short response, using original chunk`, {
            originalLength: textBlock.length,
            responseLength: resultText.length
        });
        timer.log(`⚠️ Fallback to original`);
        return textBlock;
    }
    
    timer.log(`✅ Done (output: ${resultText.length} chars)`);
    return resultText;
}

/**
 * Second pass verification to catch any missed PII
 */
async function verifyAndCleanup(text: string, index?: number, total?: number): Promise<string> {
    const label = index !== undefined ? `Verify ${index + 1}/${total}` : 'Verification';
    const timer = createTimer(label);
    log('INFO', `🔍 ${label} starting`, { textLength: text.length });
    
    const ai = getClient();

    const verifyPrompt = `Проверь текст на наличие ПРОПУЩЕННЫХ персональных данных.

НАЙДИ И ЗАМЕНИ всё, что было пропущено:
- Любые имена, фамилии, отчества (в любых падежах) -> [ФИО]
- Инициалы (А.А., И.И.) -> [ФИО]
- Телефоны -> [ТЕЛЕФОН]
- Email -> [EMAIL]
- Адреса -> [АДРЕС]
- Номера документов -> [ДОКУМЕНТ]
- Даты рождения -> [ДАТА_РОЖДЕНИЯ]
- Финансовые реквизиты -> [ФИНАНСЫ]

ВАЖНО: Если видишь что-то похожее на имя рядом с должностью (директор, менеджер, специалист) — это 100% ФИО, заменяй!

Верни ТОЛЬКО исправленный текст без комментариев.`;

    const response = await generateWithRetry(async () => {
        return ai.models.generateContent({
            model: "gemini-3-pro-preview",
            config: {
                systemInstruction: verifyPrompt,
                temperature: 0.05,
            },
            contents: text
        });
    });

    const resultText = response.text || "";
    
    // Fallback: if response is empty, return original text
    if (!resultText || resultText.length < text.length * 0.3) {
        log('WARN', `⚠️ Verification returned empty/short, keeping previous result`, {
            originalLength: text.length,
            responseLength: resultText.length
        });
        timer.log(`⚠️ Fallback to input`);
        return text;
    }
    
    timer.log(`✅ Done (output: ${resultText.length} chars)`);
    return resultText;
}

/**
 * Main entry point for full document anonymization
 */
export const anonymizeDocumentText = async (fullText: string): Promise<string> => {
    const totalTimer = createTimer('Total anonymization');
    log('INFO', `🚀 Starting full text anonymization`, {
        totalChars: fullText.length,
        estimatedChunks: Math.ceil(fullText.length / 4000)
    });
    
    // Split into chunks by paragraphs (reduced back to 5000 for stability)
    const chunks = chunkByParagraphs(fullText, 5000);
    let resultText = "";

    // First pass: main anonymization
    log('INFO', `📋 Pass 1: Main anonymization`, { totalChunks: chunks.length });
    const pass1Timer = createTimer('Pass 1');
    
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
            log('DEBUG', `⏸️ Delay 1500ms before chunk ${i + 1}`);
            await delay(1500);
        }
        
        const redactedChunk = await redactTextBlock(chunks[i], i, chunks.length);
        resultText += redactedChunk + "\n\n";
    }
    pass1Timer.log(`✅ Pass 1 complete`);

    // Second pass: verification to catch missed PII
    log('INFO', `🔍 Pass 2: Verification pass starting`);
    const pass2Timer = createTimer('Pass 2');
    await delay(2000);
    
    const verificationChunks = chunkByParagraphs(resultText.trim(), 7000);
    log('INFO', `📋 Pass 2: Verification`, { totalChunks: verificationChunks.length });
    
    let verifiedText = "";
    
    for (let i = 0; i < verificationChunks.length; i++) {
        if (i > 0) {
            log('DEBUG', `⏸️ Delay 1500ms before verification chunk ${i + 1}`);
            await delay(1500);
        }
        
        const verifiedChunk = await verifyAndCleanup(verificationChunks[i], i, verificationChunks.length);
        verifiedText += verifiedChunk + "\n\n";
    }
    pass2Timer.log(`✅ Pass 2 complete`);

    const totalTime = totalTimer.log(`🏁 Anonymization complete`);
    log('INFO', `📊 Final stats`, {
        inputChars: fullText.length,
        outputChars: verifiedText.trim().length,
        pass1Chunks: chunks.length,
        pass2Chunks: verificationChunks.length,
        totalTimeMs: totalTime
    });

    return verifiedText.trim();
};

export const testSystem = async (): Promise<boolean> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: "ping",
    });
    return !!response.text;
  } catch (error) {
    return false;
  }
};