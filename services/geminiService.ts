import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key is missing!");
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
function chunkByParagraphs(text: string, targetSize: number = 5000): string[] {
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
        try {
            return await callApi();
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429 || error.toString().includes('Too Many Requests');
            if (isRateLimit && i < retries - 1) {
                const waitTime = delayBase * Math.pow(2, i);
                console.warn(`[Gemini] Rate limit. Waiting ${waitTime}ms...`);
                await delay(waitTime);
                continue;
            }
            throw error;
        }
    }
}

/**
 * Asks Gemini to redact a specific block of text and return the REDACTED TEXT.
 */
async function redactTextBlock(textBlock: string, index: number, total: number): Promise<string> {
    console.log(`[Gemini] Redacting chunk ${index + 1}/${total}...`);
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

    return response.text || "";
}

/**
 * Second pass verification to catch any missed PII
 */
async function verifyAndCleanup(text: string): Promise<string> {
    console.log(`[Gemini] Running verification pass...`);
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

    return response.text || text;
}

/**
 * Main entry point for full document anonymization
 */
export const anonymizeDocumentText = async (fullText: string): Promise<string> => {
    console.log(`[Gemini] Starting full text anonymization (${fullText.length} chars)`);
    
    // Split into chunks by paragraphs to keep context
    const chunks = chunkByParagraphs(fullText, 4000); // Reduced chunk size for better accuracy
    let resultText = "";

    // First pass: main anonymization
    console.log(`[Gemini] Pass 1: Main anonymization (${chunks.length} chunks)`);
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await delay(1500); // Breathe between chunks
        
        const redactedChunk = await redactTextBlock(chunks[i], i, chunks.length);
        resultText += redactedChunk + "\n\n";
    }

    // Second pass: verification to catch missed PII
    console.log(`[Gemini] Pass 2: Verification pass`);
    await delay(2000);
    
    const verificationChunks = chunkByParagraphs(resultText.trim(), 6000);
    let verifiedText = "";
    
    for (let i = 0; i < verificationChunks.length; i++) {
        if (i > 0) await delay(1500);
        
        const verifiedChunk = await verifyAndCleanup(verificationChunks[i]);
        verifiedText += verifiedChunk + "\n\n";
    }

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