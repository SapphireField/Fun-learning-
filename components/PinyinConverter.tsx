import React, { useState, useEffect, useRef } from 'react';
import { Wand2, Volume2, X, Loader2, History, Trash2, Clock, Square, Upload, Download, FileText, Printer, BookOpen, AlertCircle, Save } from 'lucide-react';
import { convertLargeTextToPinyin, generateSpeech, extractTextFromFile } from '../services/geminiService';
import { playPCM, stopAudio, calculateWeightedActiveIndex } from '../utils/audio';
import { exportToEpub, exportToHtml, exportToPdf, exportToWord } from '../utils/exportUtils';
import { PinyinChar } from '../types';
import ChineseChar from './ChineseChar';

interface HistoryItem {
    id: string;
    text: string;
    data: PinyinChar[];
    timestamp: number;
}

const PinyinConverter: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<PinyinChar[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New UI State
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Playback Refs for Karaoke
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const requestRef = useRef<number | undefined>(undefined);

  // Load history from local storage on mount
  useEffect(() => {
    try {
        const saved = localStorage.getItem('pinyinHistory');
        if (saved) {
            setHistory(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
        stopAudio();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const saveToHistory = (text: string, data: PinyinChar[]) => {
      try {
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            text: text.trim(),
            data,
            timestamp: Date.now()
        };

        // Filter out existing exact duplicates and add new item to top
        const updatedHistory = [newItem, ...history.filter(h => h.text !== text.trim())].slice(50); // Limit to 50 items
        
        setHistory(updatedHistory);
        localStorage.setItem('pinyinHistory', JSON.stringify(updatedHistory));
      } catch (e) {
          console.error("Failed to save history", e);
      }
  };

  const handleManualSave = () => {
      if (result.length > 0 && inputText) {
          saveToHistory(inputText, result);
          alert("Saved to History!");
      } else {
          alert("Nothing to save! Convert some text first.");
      }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
          const updated = history.filter(h => h.id !== id);
          setHistory(updated);
          localStorage.setItem('pinyinHistory', JSON.stringify(updated));
      } catch (e) {
          console.error("Failed to delete history item", e);
      }
  };

  const loadHistoryItem = (item: HistoryItem) => {
      stopAudio();
      setIsPlaying(false);
      setPlaybackProgress(0);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      
      setInputText(item.text);
      setResult(item.data);
      setShowHistory(false);
      // Scroll to top to see result
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConvert = async () => {
    if (!inputText.trim()) return;
    stopAudio();
    setIsPlaying(false);
    setPlaybackProgress(0);
    setConversionProgress(0);
    setError(null);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    // 1. Check if we have this exact sentence in history first to speed up
    const existingItem = history.find(h => h.text === inputText.trim());
    if (existingItem) {
        setResult(existingItem.data);
        saveToHistory(existingItem.text, existingItem.data);
        return;
    }

    // 2. If not, call API
    setLoading(true);
    try {
        const data = await convertLargeTextToPinyin(inputText, (progress) => {
            setConversionProgress(progress);
        });
        
        if (data.length > 0) {
            setResult(data);
            saveToHistory(inputText, data);
        }
    } catch (e: any) {
        setError(e.message || "An error occurred");
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
        setPlaybackProgress(0);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
    }

    if (!inputText || audioLoading) return;
    
    setAudioLoading(true);
    setError(null);
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
        setError("Failed to generate audio: " + e.message);
    } finally {
        setAudioLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileProcessing(true);
    setInputText("Processing file...");
    setError(null);

    try {
        const text = await extractTextFromFile(file);
        if (text && !text.startsWith("Error")) {
            setInputText(text);
        } else {
            setInputText(text || "Error processing file.");
            if (text.startsWith("Error")) setError(text);
        }
    } catch (error: any) {
        console.error("File upload error:", error);
        setInputText("Error processing file.");
        setError(error.message);
    } finally {
        setFileProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clear = () => {
    stopAudio();
    setIsPlaying(false);
    setPlaybackProgress(0);
    setConversionProgress(0);
    setError(null);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setInputText('');
    setResult([]);
  };
  
  const activeIndex = isPlaying ? calculateWeightedActiveIndex(playbackProgress, result) : -1;

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar pb-24 relative">
      <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 border-4 border-orange-100 relative overflow-hidden flex-shrink-0 no-print">
         <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-orange-200 rounded-full opacity-50 blur-xl"></div>
         <div className="flex justify-between items-center mb-4 relative z-10">
            <h2 className="text-2xl font-black text-orange-500 flex items-center fun-font">
                <Wand2 className="mr-2" /> Pinyin Magic
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowHistory(true)}
                    className="text-gray-400 bg-orange-50 p-2 rounded-full hover:bg-orange-100 hover:text-orange-500 transition-colors"
                    title="View History"
                >
                    <History size={20} />
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileProcessing || loading}
                    className="text-orange-500 bg-orange-50 p-2 rounded-full hover:bg-orange-100 transition-colors"
                    title="Import from File"
                >
                    {fileProcessing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                </button>
            </div>
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip" 
                className="hidden" 
            />
         </div>
         
         {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-start animate-in fade-in">
                <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
            </div>
         )}
         
         <div className="relative">
            <textarea
                className="w-full p-4 rounded-xl border-2 border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-lg chinese-font font-medium resize-none placeholder:text-gray-300"
                rows={3}
                placeholder="Type Chinese, or upload Image/PDF/Word/EPUB..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                readOnly={fileProcessing}
            />
            {inputText && !fileProcessing && (
                <button onClick={clear} className="absolute right-2 top-2 p-1 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                    <X size={16} />
                </button>
            )}
         </div>

         <div className="flex flex-col gap-2 mt-4">
             <button
                onClick={handleConvert}
                disabled={loading || !inputText || fileProcessing}
                className={`flex-1 py-3 rounded-xl font-bold text-white text-lg shadow-md transition-all flex items-center justify-center
                    ${loading || !inputText || fileProcessing ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}`}
             >
                {loading ? <span className="flex items-center"><Loader2 className="animate-spin mr-2" /> Magic...</span> : 'Add Pinyin! ✨'}
             </button>
             
             {loading && conversionProgress > 0 && (
                <div className="w-full bg-orange-100 rounded-full h-2.5 mt-2">
                    <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${conversionProgress}%` }}></div>
                    <p className="text-xs text-orange-400 text-center mt-1">Processing... {conversionProgress}%</p>
                </div>
             )}
         </div>
      </div>

      {result.length > 0 && (
        <div className="bg-white rounded-3xl shadow-xl p-6 border-4 border-teal-100 mb-6 flex-shrink-0 print-content">
            <div className="flex justify-between items-center mb-4 no-print">
                <h3 className="text-xl font-bold text-teal-600 fun-font">Result</h3>
                <div className="flex gap-1">
                     <button 
                        onClick={handleManualSave}
                        className="p-2 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                        title="Force Save"
                    >
                        <Save size={18} />
                    </button>
                    <button 
                        onClick={() => exportToHtml(result)}
                        className="p-2 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                        title="Download HTML"
                    >
                        <Download size={18} />
                    </button>
                    <button 
                        onClick={() => exportToWord(result)}
                        className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Export to Word"
                    >
                        <FileText size={18} />
                    </button>
                     <button 
                        onClick={() => exportToEpub(result)}
                        className="p-2 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                        title="Export to EPUB"
                    >
                        <BookOpen size={18} />
                    </button>
                    <button 
                        onClick={() => exportToPdf(result)}
                        className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="Save as PDF"
                    >
                        <Printer size={18} />
                    </button>
                    <div className="w-px h-8 bg-gray-200 mx-1"></div>
                    <button 
                        onClick={handlePlayAudio}
                        disabled={audioLoading}
                        className={`p-2 rounded-full transition-colors flex items-center gap-2 ${
                        isPlaying 
                            ? 'bg-red-100 text-red-500 hover:bg-red-200'
                            : audioLoading 
                                ? 'bg-gray-100 text-gray-400' 
                                : 'bg-teal-100 text-teal-600 hover:bg-teal-200'
                        }`}
                    >
                        {audioLoading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : isPlaying ? (
                            <><Square size={20} className="fill-current" /> Stop</>
                        ) : (
                            <Volume2 size={24} />
                        )}
                    </button>
                </div>
            </div>
            
            <p className="text-sm text-gray-400 mb-2 italic text-center no-print">Tap a character to hide/show Pinyin</p>

            <div className="flex flex-wrap content-start justify-center">
                {result.map((item, index) => (
                    <ChineseChar 
                        key={`${index}-${item.char}`} 
                        char={item.char} 
                        pinyin={item.pinyin} 
                        size="lg" 
                        isActive={isPlaying && index === activeIndex}
                    />
                ))}
            </div>
        </div>
      )}
      
      {/* History Overlay */}
      {showHistory && (
          <div className="absolute inset-0 z-20 bg-orange-50 overflow-y-auto animate-in slide-in-from-bottom-5 p-4 pb-24">
              <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm">
                  <h3 className="font-bold text-gray-700 text-lg flex items-center"><History className="mr-2"/> Translation History</h3>
                  <button 
                    onClick={() => setShowHistory(false)} 
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                  >
                      <X size={20} />
                  </button>
              </div>
              
              <div className="space-y-3">
                {history.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <Clock size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No history yet</p>
                    </div>
                ) : (
                    history.map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => loadHistoryItem(item)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:bg-orange-50 transition-colors cursor-pointer group"
                        >
                            <div className="overflow-hidden">
                                <p className="text-gray-800 font-medium truncate chinese-font text-lg">{item.text}</p>
                                <p className="text-xs text-gray-400 mt-1">{new Date(item.timestamp).toLocaleDateString()} • {item.data.length} chars</p>
                            </div>
                            <button 
                                onClick={(e) => deleteHistoryItem(e, item.id)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all ml-2"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                )}
              </div>
          </div>
      )}
    </div>
  );
};

export default PinyinConverter;