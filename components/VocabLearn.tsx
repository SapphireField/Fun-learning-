import React, { useState, useEffect, useRef } from 'react';
import { Wand2, Volume2, X, Loader2, History, Trash2, Clock, Square, Upload, Download, FileText, Printer, BookOpen, AlertCircle, Save, Camera, Check, RotateCcw } from 'lucide-react';
import { convertLargeTextToPinyin, generateSpeech, extractTextFromFile } from '../services/geminiService';
import { playPCM, stopAudio, calculateWeightedActiveIndexForTokens } from '../utils/audio';
import { exportToHtml, exportToPdf, exportToWord } from '../utils/exportUtils';
import { PinyinChar, LearningMode } from '../types';
import WordCard from './WordCard';
import FlashcardMode from './FlashcardMode';

interface HistoryItem {
    id: string;
    text: string;
    data: PinyinChar[];
    timestamp: number;
}

const VocabLearn: React.FC<{ mode: LearningMode }> = ({ mode }) => {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<PinyinChar[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flashcard State
  const [showFlashcards, setShowFlashcards] = useState(false);
  
  // Preview State
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
        const saved = localStorage.getItem('vocabHistory');
        if (saved) {
            setHistory(JSON.parse(saved));
        }
    } catch (e) {}
  }, []);

  useEffect(() => {
    return () => {
        stopAudio();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewUrl) {
        return () => URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const saveToHistory = (text: string, data: PinyinChar[]) => {
      try {
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            text: text.trim(),
            data,
            timestamp: Date.now()
        };
        const updatedHistory = [newItem, ...history.filter(h => h.text !== text.trim())].slice(50);
        setHistory(updatedHistory);
        localStorage.setItem('vocabHistory', JSON.stringify(updatedHistory));
      } catch (e) {}
  };

  const handleManualSave = () => {
      if (result.length > 0 && inputText) {
          saveToHistory(inputText, result);
          alert("Saved to History!");
      } else {
          alert("Nothing to save!");
      }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('vocabHistory', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
      stopAudio();
      setIsPlaying(false);
      setInputText(item.text);
      setResult(item.data);
      setShowHistory(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConvert = async () => {
    if (!inputText.trim()) return;
    stopAudio();
    setIsPlaying(false);
    setError(null);
    setConversionProgress(0);
    
    const existingItem = history.find(h => h.text === inputText.trim());
    if (existingItem) {
        setResult(existingItem.data);
        saveToHistory(existingItem.text, existingItem.data);
        return;
    }

    setLoading(true);
    try {
        const data = await convertLargeTextToPinyin(inputText, setConversionProgress, mode);
        if (data.length > 0) {
            setResult(data);
            saveToHistory(inputText, data);
        }
    } catch (e: any) {
        setError(e.message || "Error occurred");
    } finally {
        setLoading(false);
        setConversionProgress(0);
    }
  };

  const animate = () => {
    if (!startTimeRef.current || !durationRef.current) return;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const progress = Math.min(elapsed / durationRef.current, 1);
    
    setPlaybackProgress(progress);
    
    if (progress < 1) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
       setPlaybackProgress(0);
       setIsPlaying(false);
    }
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
        stopAudio();
        setIsPlaying(false);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
    }
    if (!inputText || audioLoading) return;
    
    setAudioLoading(true);
    try {
        const base64Audio = await generateSpeech(inputText, 'speech');
        if (base64Audio) {
            setIsPlaying(true);
            await playPCM(base64Audio, (duration) => {
                durationRef.current = duration;
                startTimeRef.current = Date.now();
                requestRef.current = requestAnimationFrame(animate);
            });
        }
    } catch (e: any) {
        setError("Audio failed: " + e.message);
    } finally {
        setAudioLoading(false);
    }
  };

  const handlePlayWord = async (word: string) => {
      stopAudio();
      setIsPlaying(false);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);

      try {
          const base64Audio = await generateSpeech(word, 'speech');
          if (base64Audio) await playPCM(base64Audio);
      } catch (e) { console.error(e); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    } else {
        processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    setPreviewFile(null);
    setFileProcessing(true);
    setInputText("Processing file...");
    
    try {
        const text = await extractTextFromFile(file);
        if (text && !text.startsWith("Error")) {
            setInputText(text);
        } else {
            setInputText(text || "Error");
            if (text.startsWith("Error")) setError(text);
        }
    } catch (error: any) {
        setInputText("Error");
        setError(error.message);
    } finally {
        setFileProcessing(false);
    }
  };
  
  // Transform PinyinChar[] to simple token list for weight calculation
  const tokens = result.map(r => ({ text: r.char }));
  const activeIndex = isPlaying ? calculateWeightedActiveIndexForTokens(playbackProgress, tokens) : -1;

  if (showFlashcards) {
      return <FlashcardMode data={result} onClose={() => setShowFlashcards(false)} />;
  }

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar pb-24 relative">
      {/* Preview Modal */}
      {previewFile && previewUrl && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col h-full w-full">
            <div className="flex justify-between items-center p-4 bg-black/50 z-10">
                 <button onClick={() => { setPreviewFile(null); setPreviewUrl(null); }} className="text-white"><X /></button>
                 <h3 className="text-white font-bold">Review</h3>
                 <div className="w-6"></div> 
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
                <img src={previewUrl} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="p-6 bg-black/80">
                <button onClick={() => processFile(previewFile)} className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center">
                    <Check className="mr-2" /> Use Photo
                </button>
            </div>
          </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 border-4 border-blue-100 relative overflow-hidden flex-shrink-0">
         <div className="flex justify-between items-center mb-4 relative z-10">
            <h2 className="text-2xl font-black text-blue-500 flex items-center fun-font">
                <Wand2 className="mr-2" /> Word Magic
            </h2>
            <div className="flex gap-2">
                <button onClick={() => setShowHistory(true)} className="text-gray-400 bg-blue-50 p-2 rounded-full hover:bg-blue-100"><History size={20} /></button>
                <button onClick={() => cameraInputRef.current?.click()} disabled={fileProcessing} className="text-blue-500 bg-blue-50 p-2 rounded-full hover:bg-blue-100">
                    {fileProcessing ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={fileProcessing} className="text-blue-500 bg-blue-50 p-2 rounded-full hover:bg-blue-100"><Upload size={20} /></button>
            </div>
            
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,application/pdf" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleFileSelect} accept="image/*" capture="environment" className="hidden" />
         </div>
         
         {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center"><AlertCircle size={18} className="mr-2"/>{error}</div>}
         
         <div className="relative">
            <textarea
                className="w-full p-4 rounded-xl border-2 border-blue-200 focus:border-blue-400 outline-none text-lg resize-none placeholder:text-gray-300"
                rows={3}
                placeholder={mode === 'ENGLISH' ? "Type English sentences..." : "Type Chinese characters..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                readOnly={fileProcessing}
            />
            {inputText && !fileProcessing && (
                <button onClick={() => { setInputText(''); setResult([]); }} className="absolute right-2 top-2 p-1 bg-gray-100 rounded-full text-gray-400"><X size={16} /></button>
            )}
         </div>

         <button
            onClick={handleConvert}
            disabled={loading || !inputText || fileProcessing}
            className={`w-full mt-4 py-3 rounded-xl font-bold text-white text-lg shadow-md flex items-center justify-center
                ${loading ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'}`}
         >
            {loading ? <><Loader2 className="animate-spin mr-2" /> Processing...</> : 'Translate! ✨'}
         </button>
      </div>

      {result.length > 0 && (
        <div className="bg-white rounded-3xl shadow-xl p-6 border-4 border-yellow-100 mb-6 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-yellow-600 fun-font">Result</h3>
                <div className="flex gap-1">
                     <button onClick={handleManualSave} className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"><Save size={18} /></button>
                     <button onClick={() => setShowFlashcards(true)} className="p-2 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100" title="Study Flashcards"><BookOpen size={18} /></button>
                     <div className="w-px h-8 bg-gray-200 mx-1"></div>
                     <button 
                        onClick={handlePlayAudio}
                        disabled={audioLoading}
                        className={`p-2 rounded-full ${isPlaying ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'}`}
                     >
                        {audioLoading ? <Loader2 className="animate-spin" size={24} /> : isPlaying ? <Square size={20} className="fill-current" /> : <Volume2 size={24} />}
                     </button>
                </div>
            </div>
            
            <div className="flex flex-wrap content-start justify-center gap-2">
                {result.map((item, index) => (
                    <WordCard 
                        key={`${index}-${item.char}`} 
                        word={item.char} 
                        translation={item.pinyin} 
                        isActive={isPlaying && index === activeIndex}
                        onPlayAudio={handlePlayWord}
                    />
                ))}
            </div>
        </div>
      )}
      
      {showHistory && (
          <div className="absolute inset-0 z-20 bg-blue-50 overflow-y-auto p-4 pb-24 animate-in slide-in-from-bottom-5">
              <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm">
                  <h3 className="font-bold text-gray-700 flex items-center"><History className="mr-2"/> History</h3>
                  <button onClick={() => setShowHistory(false)} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                {history.map((item) => (
                    <div key={item.id} onClick={() => loadHistoryItem(item)} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center active:bg-blue-50 cursor-pointer">
                        <div className="overflow-hidden">
                            <p className="text-gray-800 font-medium truncate">{item.text}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                        </div>
                        <button onClick={(e) => deleteHistoryItem(e, item.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default VocabLearn;
