import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, Download, Printer, BookOpen, Scissors, CheckCircle2, Play, AlertCircle, FileType, Zap, History, Trash2, Clock, Save, ChevronRight } from 'lucide-react';
import { extractTextFromFile, convertLargeTextToPinyin } from '../services/geminiService';
import { exportToEpub, exportToHtml, exportToPdf, exportToWord } from '../utils/exportUtils';
import { PinyinChar } from '../types';
import ChineseChar from './ChineseChar';

interface BookPart {
    id: number;
    title: string;
    text: string;
    status: 'idle' | 'converting' | 'done';
    result: PinyinChar[];
    progress: number;
}

interface EbookHistoryItem {
    id: string;
    fileName: string;
    date: number;
    mode: 'single' | 'split';
    fullText: string;
    result?: PinyinChar[]; // For single mode
    parts?: BookPart[]; // For split mode
}

const EbookTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fullText, setFullText] = useState<string>('');
  
  // Single Mode State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PinyinChar[]>([]);
  const [status, setStatus] = useState<string>('');

  // Split Mode State
  const [mode, setMode] = useState<'single' | 'split'>('single');
  const [parts, setParts] = useState<BookPart[]>([]);
  const [convertingAll, setConvertingAll] = useState(false);

  // History State
  const [history, setHistory] = useState<EbookHistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      try {
          const saved = localStorage.getItem('ebookHistory');
          if (saved) {
              setHistory(JSON.parse(saved));
          }
      } catch (e) {
          console.error("Failed to load ebook history", e);
      }
  }, []);

  const saveToHistory = (manual: boolean = false) => {
      if (!fullText) return;

      const newItem: EbookHistoryItem = {
          id: Date.now().toString(),
          fileName: file?.name || `Book ${new Date().toLocaleDateString()}`,
          date: Date.now(),
          mode,
          fullText,
          result: mode === 'single' ? result : undefined,
          parts: mode === 'split' ? parts : undefined
      };

      try {
          // Keep only last 5 items to avoid quota limits with large books
          const updatedHistory = [newItem, ...history.filter(h => h.fullText !== fullText)].slice(0, 5);
          setHistory(updatedHistory);
          localStorage.setItem('ebookHistory', JSON.stringify(updatedHistory));
          if (manual) alert("Progress saved to history!");
      } catch (e) {
          console.error("Failed to save history", e);
          if (manual) alert("Storage full! Try deleting old history items.");
      }
  };

  const loadHistoryItem = (item: EbookHistoryItem) => {
      if (!confirm("Load this book? Current unsaved progress will be lost.")) return;

      setFile(null); // Clear file input as we loaded from history
      setFullText(item.fullText);
      setMode(item.mode);
      
      if (item.mode === 'single') {
          setResult(item.result || []);
          setParts([]);
          if (item.result && item.result.length > 0) {
              setStatus('Loaded from History');
              setProgress(100);
          } else {
              setStatus('');
              setProgress(0);
          }
      } else {
          setParts(item.parts || []);
          setResult([]);
      }
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Delete this book from history?")) return;
      
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('ebookHistory', JSON.stringify(updated));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
          setFile(selected);
          setFullText('');
          setResult([]);
          setParts([]);
          setStatus('');
          setProgress(0);
          setMode('single');
      }
  };

  const extractText = async () => {
      if (!file) return;
      
      setIsProcessing(true);
      setStatus('Reading file...');
      
      try {
          const text = await extractTextFromFile(file);
          if (!text || text.startsWith("Error")) {
              setStatus("Failed to read text from file.");
              setIsProcessing(false);
              return;
          }
          setFullText(text);
          setStatus('');
      } catch (e) {
          console.error(e);
          setStatus("Error reading file.");
      } finally {
          setIsProcessing(false);
      }
  };

  const processFullText = async () => {
      if (!fullText) return;
      
      setIsProcessing(true);
      setStatus('Initializing AI...');
      setProgress(0);

      try {
          const pinyinData = await convertLargeTextToPinyin(fullText, (percent) => {
              setProgress(percent);
              setStatus(`Converting... ${percent}%`);
          });
          
          setResult(pinyinData);
          setStatus('Complete!');
          setProgress(100);
          
          // Auto-save on completion for single mode
          setTimeout(() => saveToHistory(), 500);
          
      } catch (e) {
          console.error(e);
          setStatus("Error occurred during conversion.");
      } finally {
          setIsProcessing(false);
      }
  };

  const splitIntoParts = () => {
      if (!fullText) return;
      
      // Increased split size for efficiency with parallel processing
      const TARGET_PART_SIZE = 5000; 
      const newParts: BookPart[] = [];
      let currentText = fullText;
      let partCount = 1;

      while (currentText.length > 0) {
          if (currentText.length <= TARGET_PART_SIZE) {
              newParts.push({
                  id: partCount,
                  title: `Part ${partCount}`,
                  text: currentText,
                  status: 'idle',
                  result: [],
                  progress: 0
              });
              break;
          }

          // Smart split logic: Look for paragraph breaks
          let splitIndex = currentText.lastIndexOf('\n', TARGET_PART_SIZE);
          // If no newline, look for sentence endings
          if (splitIndex === -1) splitIndex = currentText.lastIndexOf('。', TARGET_PART_SIZE);
          if (splitIndex === -1) splitIndex = currentText.lastIndexOf('！', TARGET_PART_SIZE);
          if (splitIndex === -1) splitIndex = TARGET_PART_SIZE; // Force split

          // Include the delimiter in the first part
          splitIndex += 1;

          newParts.push({
              id: partCount,
              title: `Part ${partCount}`,
              text: currentText.substring(0, splitIndex),
              status: 'idle',
              result: [],
              progress: 0
          });

          currentText = currentText.substring(splitIndex);
          partCount++;
      }

      setParts(newParts);
      setMode('split');
  };

  const processPart = async (partId: number) => {
      const partIndex = parts.findIndex(p => p.id === partId);
      if (partIndex === -1) return;

      // Update status to converting
      setParts(prev => {
          const update = [...prev];
          update[partIndex] = { ...update[partIndex], status: 'converting', progress: 0 };
          return update;
      });

      try {
          const partText = parts[partIndex].text;
          const pinyinData = await convertLargeTextToPinyin(partText, (percent) => {
               setParts(prev => {
                   const update = [...prev];
                   // Only update if still converting
                   if (update[partIndex] && update[partIndex].status === 'converting') {
                       update[partIndex] = { ...update[partIndex], progress: percent };
                   }
                   return update;
               });
          });
          
          setParts(prev => {
               const update = [...prev];
               if (update[partIndex]) {
                   update[partIndex] = { ...update[partIndex], status: 'done', result: pinyinData, progress: 100 };
               }
               return update;
          });

      } catch (e) {
          console.error(e);
          setParts(prev => {
               const update = [...prev];
               if (update[partIndex]) {
                   update[partIndex] = { ...update[partIndex], status: 'idle', progress: 0 }; // Reset on fail
               }
               return update;
          });
          if (!convertingAll) alert(`Failed to convert Part ${partId}. Please try again.`);
      }
  };

  const convertAllParts = async () => {
      setConvertingAll(true);
      
      // Process parts sequentially to avoid quota issues on the E-book tool level
      // The service level handles parallel chunks within each part
      for (const part of parts) {
          if (part.status !== 'done') {
             await processPart(part.id);
          }
      }
      
      setConvertingAll(false);
      // Auto save after batch
      saveToHistory();
  };

  const getFileName = (suffix: string = '') => {
      const base = file ? file.name.replace(/\.[^/.]+$/, "") : "panda-lingo-book";
      return suffix ? `${base}-${suffix}` : base;
  };

  const getPreviewText = (result: PinyinChar[]) => {
      if (!result || result.length === 0) return '';
      return result.slice(0, 15).map(i => i.pinyin ? `${i.char}(${i.pinyin})` : i.char).join(' ') + '...';
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar pb-24">
        <div className="mb-6 mt-2">
            <h2 className="text-3xl font-black text-gray-800 flex items-center">
                <span className="bg-purple-100 p-2 rounded-xl mr-3 text-purple-500">📖</span>
                Add Pinyin to Books
            </h2>
            <p className="text-gray-400 ml-14 mt-1">Upload EPUB, PDF & Docs to add Pinyin</p>
        </div>

        {/* 1. Upload Section */}
        {!fullText && (
            <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`bg-white border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all mb-6 min-h-[200px]
                ${isProcessing ? 'border-gray-200 cursor-wait opacity-80' : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'}`}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect}
                    accept=".epub,.pdf,.docx" 
                    className="hidden" 
                />
                
                {isProcessing ? (
                    <>
                        <Loader2 size={48} className="text-purple-500 mb-4 animate-spin" />
                        <p className="font-bold text-gray-600">{status}</p>
                    </>
                ) : (
                    <>
                        <Upload size={48} className="text-gray-300 mb-4" />
                        <p className="font-bold text-gray-600 text-lg">Upload Book</p>
                        <p className="text-sm text-gray-400 mt-2">Supports EPUB, PDF, Word</p>
                    </>
                )}
            </div>
        )}
        
        {/* 2. Analysis / Mode Selection */}
        {file && !fullText && !isProcessing && (
            <div className="text-center">
                <button 
                    onClick={extractText}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all active:scale-95 flex items-center mx-auto"
                >
                    <BookOpen className="mr-2" /> Read File Contents
                </button>
            </div>
        )}

        {/* 3. Processing Options */}
        {fullText && (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-gray-800 truncate max-w-[150px]">{file?.name || 'Loaded File'}</h3>
                        <p className="text-xs text-gray-500">{fullText.length} characters loaded</p>
                    </div>
                    <button 
                        onClick={() => { setFullText(''); setFile(null); setParts([]); setMode('single'); }}
                        className="text-gray-400 hover:text-red-500 p-2"
                        title="Remove File"
                    >
                        <AlertCircle size={20} />
                    </button>
                </div>

                {mode === 'single' && (
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={processFullText}
                            disabled={isProcessing}
                            className={`p-6 rounded-3xl text-left transition-all border-2 relative overflow-hidden group
                            ${isProcessing ? 'bg-gray-100 border-gray-200 opacity-50' : 'bg-purple-500 border-purple-500 text-white hover:shadow-lg'}`}
                        >
                             <div className="relative z-10">
                                <h3 className="text-xl font-black mb-1 flex items-center"><BookOpen className="mr-2"/> Process Whole Book</h3>
                                <p className="opacity-80 text-sm">Convert everything at once. Best for smaller files or overnight processing.</p>
                             </div>
                             {!isProcessing && <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                <BookOpen size={120} />
                             </div>}
                        </button>

                        <button 
                            onClick={splitIntoParts}
                            className="p-6 rounded-3xl text-left transition-all border-2 border-orange-200 bg-white hover:border-orange-400 hover:shadow-lg group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <h3 className="text-xl font-black text-orange-500 mb-1 flex items-center"><Scissors className="mr-2"/> Divide into Parts</h3>
                                <p className="text-gray-500 text-sm">Split into chapters/sections. Convert and export one by one.</p>
                            </div>
                            <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity text-orange-500">
                                <Scissors size={120} />
                            </div>
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* 4. Single Mode Processing UI */}
        {mode === 'single' && isProcessing && (
             <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm border border-purple-100 text-center">
                 <Loader2 className="animate-spin mx-auto text-purple-500 mb-2" size={32}/>
                 <p className="font-bold text-gray-700 mb-2">{status}</p>
                 <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                     <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>
             </div>
        )}

        {/* 5. Result Actions (Single Mode) */}
        {mode === 'single' && result.length > 0 && !isProcessing && (
             <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm border border-green-100 text-center animate-in slide-in-from-bottom-4">
                 <div className="bg-green-100 text-green-600 px-4 py-2 rounded-full inline-flex items-center text-sm font-bold mb-4">
                     <span className="mr-2">✓</span> Conversion Complete
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => exportToEpub(result, getFileName(), getFileName())}
                        className="p-3 bg-purple-50 text-purple-600 rounded-xl font-bold hover:bg-purple-100 flex flex-col items-center justify-center gap-1"
                    >
                        <BookOpen size={20} />
                        <span className="text-xs">EPUB</span>
                    </button>
                    <button 
                        onClick={() => exportToPdf(result, getFileName())}
                        className="p-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 flex flex-col items-center justify-center gap-1"
                    >
                        <Printer size={20} />
                        <span className="text-xs">PDF</span>
                    </button>
                    <button 
                        onClick={() => exportToWord(result, getFileName())}
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 flex flex-col items-center justify-center gap-1"
                    >
                        <FileText size={20} />
                        <span className="text-xs">Word</span>
                    </button>
                    <button 
                        onClick={() => exportToHtml(result, getFileName())}
                        className="p-3 bg-teal-50 text-teal-600 rounded-xl font-bold hover:bg-teal-100 flex flex-col items-center justify-center gap-1"
                    >
                        <Download size={20} />
                        <span className="text-xs">HTML</span>
                    </button>
                 </div>
             </div>
        )}

        {/* 6. Split Mode UI */}
        {mode === 'split' && (
            <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-bold text-gray-600">{parts.length} Parts Created</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => saveToHistory(true)}
                            className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200 flex items-center"
                            title="Save progress to history"
                        >
                            <Save size={12} className="mr-1"/> Save Progress
                        </button>
                        <button onClick={() => setMode('single')} className="text-xs text-orange-500 font-bold hover:underline">
                            Cancel Split
                        </button>
                    </div>
                </div>

                <button 
                    onClick={convertAllParts}
                    disabled={convertingAll}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center shadow-md transition-all
                    ${convertingAll ? 'bg-purple-200 text-white cursor-wait' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                >
                    {convertingAll ? <><Loader2 className="animate-spin mr-2" /> Processing...</> : <><Zap className="mr-2" /> Convert All Parts</>}
                </button>
                
                {parts.map((part) => (
                    <div key={part.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-gray-800">{part.title}</h4>
                                <p className="text-xs text-gray-400">{part.text.length} chars</p>
                            </div>
                            {part.status === 'done' && <CheckCircle2 className="text-green-500" size={20} />}
                            {part.status === 'converting' && <Loader2 className="text-orange-500 animate-spin" size={20} />}
                            {part.status === 'idle' && <div className="w-5 h-5 rounded-full border-2 border-gray-200"></div>}
                        </div>
                        
                        {/* Progress Bar for this part */}
                        {part.status === 'converting' && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                                <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${part.progress}%` }}></div>
                            </div>
                        )}
                        
                        {/* Preview for done parts */}
                        {part.status === 'done' && (
                            <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-500 mb-3 truncate font-mono">
                                Preview: {getPreviewText(part.result)}
                            </div>
                        )}

                        <div className="flex gap-2 mt-2">
                            {part.status !== 'done' ? (
                                <button 
                                    onClick={() => processPart(part.id)}
                                    disabled={part.status === 'converting' || convertingAll}
                                    className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center
                                    ${part.status === 'converting' || convertingAll ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                                >
                                    {part.status === 'converting' ? 'Converting...' : 'Convert'}
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => exportToEpub(part.result, getFileName(part.title), getFileName(part.title))}
                                        className="flex-1 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-xs font-bold"
                                    >
                                        EPUB
                                    </button>
                                    <button 
                                        onClick={() => exportToWord(part.result, getFileName(part.title))}
                                        className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold"
                                    >
                                        Word
                                    </button>
                                    <button 
                                        onClick={() => exportToHtml(part.result, getFileName(part.title))}
                                        className="flex-1 py-2 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg text-xs font-bold"
                                    >
                                        HTML
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* 7. History Section */}
        <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-gray-500 font-bold flex items-center mb-4 text-sm uppercase tracking-wider">
                <History size={16} className="mr-2"/> Book History
            </h3>
            
            {history.length === 0 ? (
                <div className="text-center py-6 text-gray-300 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-xs">No saved books</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => loadHistoryItem(item)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:bg-purple-50 transition-colors cursor-pointer group"
                        >
                            <div className="overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <FileType size={16} className="text-purple-400"/>
                                    <p className="text-gray-800 font-bold truncate text-sm max-w-[150px]">{item.fileName}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1 flex items-center">
                                    <Clock size={10} className="mr-1"/>
                                    {new Date(item.date).toLocaleDateString()} • {item.mode === 'split' ? `${item.parts?.length} parts` : 'Full'}
                                </p>
                            </div>
                            <div className="flex items-center">
                                <ChevronRight size={16} className="text-gray-300 mr-2"/>
                                <button 
                                    onClick={(e) => deleteHistoryItem(e, item.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default EbookTool;