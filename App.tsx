import React, { useState, useRef } from 'react';
import { BookOpen, MessageCircle, Library, Settings, Download, Upload, X, Save, FileType } from 'lucide-react';
import PinyinConverter from './components/PinyinConverter';
import ChatInterface from './components/ChatInterface';
import SongLibrary from './components/SongLibrary';
import EbookTool from './components/EbookTool';
import { AppTab } from './types';
import { stopAudio } from './utils/audio';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.LEARN);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (tab: AppTab) => {
    stopAudio(); // Stop any playing audio when switching tabs
    setActiveTab(tab);
  };

  const handleBackup = () => {
    try {
        const backupData = {
            pinyinHistory: localStorage.getItem('pinyinHistory'),
            customItems: localStorage.getItem('customItems'),
            ebookHistory: localStorage.getItem('ebookHistory'),
            chatHistory: localStorage.getItem('chatHistory'),
            timestamp: Date.now(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `panda-lingo-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Backup failed", e);
        alert("Failed to create backup.");
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            
            if (json.pinyinHistory) {
                localStorage.setItem('pinyinHistory', json.pinyinHistory);
            }
            if (json.customItems) {
                localStorage.setItem('customItems', json.customItems);
            }
            if (json.ebookHistory) {
                localStorage.setItem('ebookHistory', json.ebookHistory);
            }
            if (json.chatHistory) {
                localStorage.setItem('chatHistory', json.chatHistory);
            }
            
            alert("Progress restored successfully! The app will now reload.");
            window.location.reload();
        } catch (error) {
            console.error("Restore failed", error);
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-orange-50 font-sans">
      
      {/* Global Header Controls (Absolute) */}
      <div className="absolute top-4 right-4 z-50">
        <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm text-gray-400 hover:text-orange-500 transition-colors"
            title="Data Settings"
        >
            <Settings size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === AppTab.LEARN && <PinyinConverter />}
        {activeTab === AppTab.CHAT && <ChatInterface />}
        {activeTab === AppTab.SONGS && <SongLibrary />}
        {activeTab === AppTab.EBOOKS && <EbookTool />}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-2 border-orange-100 relative">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={20} />
                </button>
                
                <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center">
                    <Save className="mr-2 text-orange-500" size={20}/> Save Progress
                </h2>
                <p className="text-sm text-gray-500 mb-6">Backup your learning history and custom library to a file.</p>
                
                <div className="space-y-3">
                    <button 
                        onClick={handleBackup}
                        className="w-full py-4 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center hover:bg-orange-600 transition-colors shadow-md active:scale-95"
                    >
                        <Download className="mr-2" size={20} /> Download Backup
                    </button>
                    
                    <div className="relative">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 rounded-xl bg-orange-50 text-orange-600 font-bold flex items-center justify-center hover:bg-orange-100 transition-colors border-2 border-orange-100 active:scale-95"
                        >
                            <Upload className="mr-2" size={20} /> Restore from File
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleRestore}
                            accept=".json"
                            className="hidden"
                        />
                    </div>
                </div>
                
                <p className="text-xs text-center text-gray-400 mt-6">
                    Note: Restoring will overwrite your current history.
                </p>
            </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pt-2 pb-6 px-4 z-20">
        <div className="max-w-md mx-auto flex justify-between items-center gap-1">
            
            <button
                onClick={() => handleTabChange(AppTab.LEARN)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${
                    activeTab === AppTab.LEARN 
                    ? 'text-orange-500 bg-orange-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <BookOpen size={24} strokeWidth={activeTab === AppTab.LEARN ? 3 : 2} />
                <span className="text-[10px] font-bold">Learn</span>
            </button>

            <button
                onClick={() => handleTabChange(AppTab.EBOOKS)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${
                    activeTab === AppTab.EBOOKS 
                    ? 'text-purple-500 bg-purple-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <FileType size={24} strokeWidth={activeTab === AppTab.EBOOKS ? 3 : 2} />
                <span className="text-[10px] font-bold">E-Books</span>
            </button>

            <button
                onClick={() => handleTabChange(AppTab.CHAT)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${
                    activeTab === AppTab.CHAT 
                    ? 'text-blue-500 bg-blue-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <MessageCircle size={24} strokeWidth={activeTab === AppTab.CHAT ? 3 : 2} />
                <span className="text-[10px] font-bold">Talk</span>
            </button>

            <button
                onClick={() => handleTabChange(AppTab.SONGS)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${
                    activeTab === AppTab.SONGS 
                    ? 'text-green-500 bg-green-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <Library size={24} strokeWidth={activeTab === AppTab.SONGS ? 3 : 2} />
                <span className="text-[10px] font-bold text-center leading-tight">Stories</span>
            </button>

        </div>
      </nav>
    </div>
  );
};

export default App;