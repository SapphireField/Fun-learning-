import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { PinyinChar, ChatResponse, QuizQuestion, LearningMode } from '../types';

const apiKey = process.env.API_KEY;

// Initialize AI, but we will check for key presence in functions to give better UI feedback
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const checkApiKey = () => {
    if (!apiKey || apiKey.trim() === '') {
        throw new Error("API Key is missing. Please add it in Vercel Settings (Environment Variables).");
    }
};

const chatResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chinese: { type: Type.STRING, description: "The complete response in simplified Chinese characters" },
    english: { type: Type.STRING, description: "The English translation or original meaning" },
    aligned: {
      type: Type.ARRAY,
      description: "Breakdown of the response into character-pinyin pairs",
      items: {
        type: Type.OBJECT,
        properties: {
            char: { type: Type.STRING },
            pinyin: { type: Type.STRING }
        },
        required: ["char", "pinyin"]
      }
    }
  },
  required: ["chinese", "english", "aligned"],
};

const libraryContentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chineseTitle: { type: Type.STRING, description: "The title of the song or story in Chinese" },
    content: { type: Type.STRING, description: "The complete Chinese lyrics or story text (Simplified Chinese)." },
    english: { type: Type.STRING, description: "The English translation of the content." },
    type: { type: Type.STRING, enum: ["rhyme", "story"], description: "Whether this is a song/rhyme or a story." },
  },
  required: ["chineseTitle", "content", "english", "type"],
};

const quizSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING, description: "The question text" },
      pinyin: { type: Type.STRING, description: "Pinyin for the question if relevant" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 possible answers" },
      correctAnswer: { type: Type.INTEGER, description: "Index of the correct answer (0-3)" },
      explanation: { type: Type.STRING, description: "Brief explanation" }
    },
    required: ["question", "options", "correctAnswer", "explanation"]
  }
};

const vocabSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            char: { type: Type.STRING, description: "The word or character" },
            pinyin: { type: Type.STRING, description: "The Pinyin, translation, or IPA" }
        },
        required: ["char", "pinyin"]
    }
};

// In-memory cache
const pinyinCache = new Map<string, PinyinChar[]>();

// Helper to chunk text
const chunkText = (text: string, maxLength: number = 2000): string[] => {
  const chunks: string[] = [];
  let currentText = text;

  while (currentText.length > 0) {
    if (currentText.length <= maxLength) {
      chunks.push(currentText);
      break;
    }

    let splitIndex = currentText.lastIndexOf('\n', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('。', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('！', maxLength);
    if (splitIndex === -1) splitIndex = maxLength;
    else splitIndex += 1;

    chunks.push(currentText.substring(0, splitIndex));
    currentText = currentText.substring(splitIndex);
  }

  return chunks;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processChunkWithRetries = async (chunk: string, index: number, mode: LearningMode): Promise<PinyinChar[]> => {
    let retryCount = 0;
    const isEnglish = mode === 'ENGLISH';
    
    while (retryCount < 5) {
        try {
            const prompt = isEnglish 
                ? `Analyze the following English text.
                   Return a PLAIN TEXT list. Format: Word|Chinese Translation
                   Rules:
                   1. Split by meaningful words/phrases.
                   2. Provide concise Chinese meaning.
                   3. Format: "Hello|你好"
                   4. Keep punctuation as separate items with empty translation (e.g. "?|")`
                : `Analyze the input text.
                   Task: Convert to Chinese Characters with Pinyin.
                   Logic:
                   - If input is already Chinese: Provide Pinyin.
                   - If input is ANOTHER LANGUAGE (English, French, Spanish, etc.): TRANSLATE it to Simplified Chinese first, then provide Pinyin for the translation.
                   
                   Return PLAIN TEXT list. Format: Character|Pinyin
                   Rules:
                   1. One char per line.
                   2. Standard Pinyin (nǐ).
                   3. Punctuation has empty pinyin (e.g. "，|").`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `${prompt}\n\nInput Text:\n${chunk}`,
            });
        
            const textOutput = response.text;
            if (textOutput) {
                const lines = textOutput.split('\n');
                const chunkResult: PinyinChar[] = [];
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    const parts = trimmedLine.split('|');
                    if (parts.length >= 2) {
                        chunkResult.push({
                            char: parts[0].trim(),
                            pinyin: parts[1].trim()
                        });
                    } else {
                        chunkResult.push({ char: trimmedLine[0], pinyin: '' });
                    }
                }
                if (chunkResult.length > 0) return chunkResult;
            }
            throw new Error("Empty result");

        } catch (e: any) {
            let waitTime = 1000 * Math.pow(2, retryCount);
            if (e.toString().includes('429')) waitTime = 5000;
            retryCount++;
            if (retryCount < 5) await delay(waitTime);
        }
    }
    return chunk.split('').map(c => ({ char: c, pinyin: '' }));
};

export const convertLargeTextToPinyin = async (text: string, onProgress?: (percent: number) => void, mode: LearningMode = 'CHINESE'): Promise<PinyinChar[]> => {
    checkApiKey();
    const trimmedText = text.trim();
    if (!trimmedText) return [];

    const cacheKey = `${mode}:${trimmedText}`;
    if (pinyinCache.has(cacheKey)) {
        if (onProgress) onProgress(100);
        return pinyinCache.get(cacheKey)!;
    }

    const chunks = chunkText(trimmedText, 2000);
    let combinedResult: PinyinChar[] = [];
    
    // Batch process for speed
    const BATCH_SIZE = 2;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((chunk, batchIndex) => 
            processChunkWithRetries(chunk, i + batchIndex, mode)
        );
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(res => combinedResult = [...combinedResult, ...res]);

        if (onProgress) onProgress(Math.round(((i + batch.length) / chunks.length) * 100));
    }

    pinyinCache.set(cacheKey, combinedResult);
    return combinedResult;
};

// ... [Existing File Helpers: base64ToArrayBuffer, extractTextFromEpub, extractTextFromFile, extractTextFromMedia] ...
// Helper for Mammoth to process docx
function base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function extractTextFromEpub(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!(window as any).JSZip) return "Error: JSZip not loaded";
  
  try {
    const zip = new (window as any).JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    
    let text = "";
    const fileNames = Object.keys(loadedZip.files);
    fileNames.sort();

    const parser = new DOMParser();

    for (const fileName of fileNames) {
      if (fileName.match(/\.(xhtml|html)$/i)) {
        const content = await loadedZip.files[fileName].async("string");
        const doc = parser.parseFromString(content, 'text/html');
        
        const styles = doc.querySelectorAll('style, script');
        styles.forEach(el => el.remove());
        
        const blocks = doc.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6, li');
        blocks.forEach(block => {
            block.after(doc.createTextNode('\n'));
        });

        const cleanText = doc.body.textContent || "";
        const formattedText = cleanText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
        
        if (formattedText) {
             text += formattedText + "\n\n";
        }
      }
    }
    return text || "No text found in EPUB";
  } catch (e) {
    console.error("EPUB extraction error", e);
    return "Error reading EPUB file";
  }
}

export const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        if ((window as any).mammoth) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await (window as any).mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value;
        } else {
            return "Error: Document processor not loaded.";
        }
    }

    if (file.type === 'application/epub+zip') {
        const arrayBuffer = await file.arrayBuffer();
        return await extractTextFromEpub(arrayBuffer);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
             const base64String = event.target?.result as string;
             if (base64String && base64String.includes(',')) {
                 const base64Data = base64String.split(',')[1];
                 const text = await extractTextFromMedia(base64Data, file.type);
                 resolve(text);
             } else {
                 resolve("Error: Could not read file data.");
             }
        };
        reader.onerror = () => resolve("Error: Failed to read file.");
        reader.readAsDataURL(file);
    });
  } catch (error: any) {
    console.error("File extraction error:", error);
    return `Error reading file: ${error.message}`;
  }
}

export const extractTextFromMedia = async (base64Data: string, mimeType: string): Promise<string> => {
  checkApiKey();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Transcribe text from this image. If it's Chinese, return it. If it's another language, return the original text (Teacher Panda will translate it later).",
          },
        ],
      },
    });

    const text = response.text;
    if (!text) {
        throw new Error("AI returned empty response");
    }
    return text;
  } catch (error: any) {
    console.error("Error extracting text:", error);
    throw error;
  }
};

export const chatWithPanda = async (
  message: string, 
  history: {role: string, parts: {text: string}[]}[]
): Promise<ChatResponse> => {
  checkApiKey();
  try {
    const recentHistory = history.slice(-6); 
    
    let promptContext = "History:\n";
    recentHistory.forEach(h => {
        promptContext += `${h.role}: ${h.parts[0].text}\n`;
    });
    
    const prompt = `
      ${promptContext}
      User Input: "${message}"

      Role: Friendly Chinese tutor & Translator.
      
      Instructions:
      1. If User Input is a specific translation request OR in a language other than Chinese (e.g. Spanish, French, German):
         -> TRANSLATE the meaning into Simplified Chinese.
         -> Set "english" field to the detected language meaning or original text.
      2. If User Input is conversational Chinese:
         -> Reply naturally in simple Chinese.
      3. Always provide Pinyin in the "aligned" array for the Chinese characters.
      
      OUTPUT JSON ONLY.
      Structure: { "chinese": "...", "english": "...", "aligned": [{"char":"中","pinyin":"zhōng"},...] }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response");
    return JSON.parse(jsonText) as ChatResponse;

  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const generateQuiz = async (topic: string, mode: LearningMode = 'CHINESE'): Promise<QuizQuestion[]> => {
    checkApiKey();
    try {
        const langInstruction = mode === 'ENGLISH' 
            ? "Teach English to Chinese kids." 
            : "Teach Chinese to English kids.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 5 multiple-choice quiz questions about "${topic}". ${langInstruction}
            Focus on vocabulary suitable for children.
            JSON Output only.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            },
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText) as QuizQuestion[];
    } catch (error) {
        console.error("Quiz error", error);
        throw error;
    }
};

export const generateVocabulary = async (topic: string, mode: LearningMode = 'CHINESE'): Promise<PinyinChar[]> => {
    checkApiKey();
    try {
        const langInstruction = mode === 'ENGLISH'
            ? "List 10 English words about the topic with Chinese translation."
            : "List 10 Chinese words about the topic with Pinyin.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate vocabulary list for topic: "${topic}". ${langInstruction}
            JSON Output: [{"char": "Word", "pinyin": "Translation/Pinyin"}]`,
            config: {
                responseMimeType: "application/json",
                responseSchema: vocabSchema,
            },
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText) as PinyinChar[];
    } catch (e) {
        console.error("Vocab error", e);
        throw e;
    }
};

export const generateSpeech = async (text: string, style: 'speech' | 'song' | 'story' = 'speech'): Promise<string | null> => {
  checkApiKey();
  try {
    let textToProcess = text.substring(0, 4500); 

    if (style === 'song') {
        textToProcess = `Speak in Mandarin Chinese. Cheerfully recite: ${textToProcess}`;
    } else {
        textToProcess = `Speak in Mandarin Chinese: ${textToProcess}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text: textToProcess }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' } 
          }
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    return null;
  }
};

export const getSongLyrics = async (title: string): Promise<{chineseTitle: string, content: string, english: string, type: 'rhyme' | 'story'} | null> => {
  checkApiKey();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find Chinese content for "${title}". JSON Format only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: libraryContentSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;
    return JSON.parse(jsonText);
  } catch (error) {
    return null;
  }
};