import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { PinyinChar, ChatResponse } from '../types';

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is not defined in the environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const pinyinSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      char: { type: Type.STRING },
      pinyin: { type: Type.STRING },
    },
    required: ["char", "pinyin"],
  },
};

const chatResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chinese: { type: Type.STRING, description: "The response in simplified Chinese characters" },
    pinyin: { type: Type.STRING, description: "The Pinyin for the chinese response with tone marks (e.g. hǎo)" },
    english: { type: Type.STRING, description: "The English translation of the response" },
  },
  required: ["chinese", "pinyin", "english"],
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

// In-memory cache for pinyin conversion to speed up repeated requests within the session
const pinyinCache = new Map<string, PinyinChar[]>();

// Helper to chunk text into manageable pieces for the API
// Increased default maxLength to 2500 since we use text output and need speed
const chunkText = (text: string, maxLength: number = 2500): string[] => {
  const chunks: string[] = [];
  let currentText = text;

  while (currentText.length > 0) {
    if (currentText.length <= maxLength) {
      chunks.push(currentText);
      break;
    }

    // Find the best split point (punctuation or newline) near the maxLength
    let splitIndex = currentText.lastIndexOf('\n', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('。', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('！', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('？', maxLength);
    if (splitIndex === -1) splitIndex = currentText.lastIndexOf('，', maxLength);
    
    // If no punctuation found, force split at maxLength
    if (splitIndex === -1) splitIndex = maxLength;
    else splitIndex += 1; // Include the punctuation in the chunk

    chunks.push(currentText.substring(0, splitIndex));
    currentText = currentText.substring(splitIndex);
  }

  return chunks;
};

export const convertToPinyin = async (text: string): Promise<PinyinChar[]> => {
  // This function is kept for small, single-shot requests like Chat/Library
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  if (pinyinCache.has(trimmedText)) {
    return pinyinCache.get(trimmedText)!;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Break down the following Chinese text into individual characters and provide the Pinyin for each. 
      IMPORTANT RULES:
      1. Use standard Pinyin with tone marks for the 'pinyin' field (e.g., "nǐ"), NOT numbers.
      2. Keep punctuation marks (like ，。！？：；) as separate items in the array.
      3. For punctuation marks, strictly set the 'pinyin' field to an empty string "".
      
      Text: "${trimmedText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: pinyinSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    const result = JSON.parse(jsonText) as PinyinChar[];
    pinyinCache.set(trimmedText, result);
    return result;
  } catch (error) {
    console.error("Error converting to pinyin:", error);
    return [];
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process a single chunk with robust retry logic
const processChunkWithRetries = async (chunk: string, index: number): Promise<PinyinChar[]> => {
    let retryCount = 0;
    
    while (retryCount < 5) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Break down the following Chinese text into individual characters and provide the Pinyin for each.
                
                CRITICAL INSTRUCTION:
                Return the result as a PLAIN TEXT list.
                Format each line exactly as: Character|Pinyin
                
                Rules:
                1. One character per line.
                2. Use standard Pinyin with tone marks (e.g. nǐ).
                3. For punctuation, strictly leave the pinyin part empty (e.g. ，|).
                4. Do NOT use markdown code blocks. Do NOT use JSON.
                5. Be robust. If whitespace is odd, ignore it.
                
                Text to convert:
                ${chunk}`,
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
                        // Fallback
                        chunkResult.push({ char: trimmedLine[0], pinyin: '' });
                    }
                }

                if (chunkResult.length > 0) {
                    return chunkResult;
                }
            }
            throw new Error("Empty result from parsing");

        } catch (e: any) {
            console.error(`Error converting chunk ${index} (attempt ${retryCount + 1}):`, e);
            
            // EXPONENTIAL BACKOFF
            let waitTime = 2000 * Math.pow(2, retryCount); 
            
            const errorMsg = e.toString().toLowerCase();
            if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('limit') || errorMsg.includes('exceeded')) {
                    console.warn("Quota limit hit. Backing off...");
                    waitTime = 5000 + (retryCount * 2000); // Wait longer for quota
            }

            retryCount++;
            if (retryCount < 5) {
                await delay(waitTime); 
            }
        }
    }
    
    // Final fallback after all retries fail: just return plain chars
    return chunk.split('').map(c => ({ char: c, pinyin: '' }));
};

export const convertLargeTextToPinyin = async (text: string, onProgress?: (percent: number) => void): Promise<PinyinChar[]> => {
    const trimmedText = text.trim();
    if (!trimmedText) return [];

    if (pinyinCache.has(trimmedText)) {
        if (onProgress) onProgress(100);
        return pinyinCache.get(trimmedText)!;
    }

    const chunks = chunkText(trimmedText, 2500);
    let combinedResult: PinyinChar[] = [];
    
    // Process in batches to speed up (Concurrency = 2)
    const BATCH_SIZE = 2;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((chunk, batchIndex) => 
            processChunkWithRetries(chunk, i + batchIndex)
        );
        
        // Wait for current batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(res => {
            combinedResult = [...combinedResult, ...res];
        });

        if (onProgress) {
            onProgress(Math.round(((i + batch.length) / chunks.length) * 100));
        }
    }

    pinyinCache.set(trimmedText, combinedResult);
    return combinedResult;
};

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

// Helper to extract text from EPUB
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
             const base64Data = base64String.split(',')[1];
             if (base64Data) {
                 const text = await extractTextFromMedia(base64Data, file.type);
                 resolve(text);
             } else {
                 resolve("Error processing file");
             }
        };
        reader.onerror = () => resolve("Error reading file");
        reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error("File extraction error:", error);
    return "Error reading file";
  }
}

export const extractTextFromMedia = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Please extract all the Chinese text from this image or document. Return ONLY the text content. Do not add any explanations.",
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Error extracting text:", error);
    return "";
  }
};

export const chatWithPanda = async (
  message: string, 
  history: {role: string, parts: {text: string}[]}[]
): Promise<ChatResponse> => {
  try {
    let promptContext = "History:\n";
    history.forEach(h => {
        promptContext += `${h.role}: ${h.parts[0].text}\n`;
    });
    
    const prompt = `
      ${promptContext}
      User: ${message}
      
      You are "Panda", a friendly, enthusiastic, and patient Chinese tutor for children. 
      Your goal is to help kids learn Chinese conversationally.
      Keep your sentences relatively simple but natural.
      Respond to the user's message in Chinese.
      
      CRITICAL OUTPUT RULES:
      1. Strictly follow the JSON schema provided.
      2. For the 'pinyin' field, YOU MUST USE TONE MARKS (e.g. "wǒ xǐ huān"), do NOT use numbers.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema,
        systemInstruction: "You are a helpful Chinese language tutor for kids. Always use correct Pinyin with tone marks."
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    return JSON.parse(jsonText) as ChatResponse;

  } catch (error) {
    console.error("Chat error:", error);
    return {
      chinese: "出错了",
      pinyin: "chū cuò le",
      english: "Something went wrong. Try again!"
    };
  }
};

export const generateSpeech = async (text: string, style: 'speech' | 'song' | 'story' = 'speech'): Promise<string | null> => {
  try {
    let textToProcess = text;
    if (textToProcess.length > 4500) {
        textToProcess = textToProcess.substring(0, 4500); 
    }

    if (style === 'song') {
        textToProcess = `Cheerfully and rhythmically recite the following Chinese nursery rhyme: ${textToProcess}`;
    } else if (style === 'story') {
        textToProcess = `Read the following Chinese story warmly, slowly, and expressively for a child: ${textToProcess}`;
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
};

export const getSongLyrics = async (title: string): Promise<{chineseTitle: string, content: string, english: string, type: 'rhyme' | 'story'} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find the content for the Chinese children's song, rhyme, or story titled "${title}". 
      If it is a song/rhyme, provide the lyrics. If it is a story, provide the story text.
      Return the content in Simplified Chinese. Also provide a Chinese title if the input is English.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: libraryContentSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error fetching library content:", error);
    return null;
  }
};