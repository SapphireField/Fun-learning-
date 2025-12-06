import React, { useState } from 'react';
import { BookOpen, MessageCircle, Library, FileType, Gamepad2 } from 'lucide-react';
import PinyinConverter from './components/PinyinConverter';
import ChatInterface from './components/ChatInterface';
import SongLibrary from './components/SongLibrary';
import EbookTool from './components/EbookTool';
import GameMode from './components/GameMode';
import { AppTab } from './types';
import { stopAudio } from './utils/audio';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.LEARN);

  const handleTabChange = (tab: AppTab) => {
    stopAudio(); // Stop any playing audio when switching tabs
    setActiveTab(tab);
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-orange-50 font-sans">
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === AppTab.LEARN && <PinyinConverter />}
        {activeTab === AppTab.CHAT && <ChatInterface />}
        {activeTab === AppTab.SONGS && <SongLibrary />}
        {activeTab === AppTab.EBOOKS && <EbookTool />}
        {activeTab === AppTab.GAME && <GameMode />}
      </div>

      {/* Bottom Navigation */}
      <nav className="bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pt-2 pb-6 px-4 z-20">
        <div className="max-w-md mx-auto flex justify-between items-center gap-1">
            
            {/* 1. Learn */}
            <button
                onClick={() => handleTabChange(AppTab.LEARN)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-14 ${
                    activeTab === AppTab.LEARN 
                    ? 'text-orange-500 bg-orange-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <BookOpen size={20} strokeWidth={activeTab === AppTab.LEARN ? 3 : 2} />
                <span className="text-[9px] font-bold">Learn</span>
            </button>

            {/* 2. Talk */}
            <button
                onClick={() => handleTabChange(AppTab.CHAT)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-14 ${
                    activeTab === AppTab.CHAT 
                    ? 'text-blue-500 bg-blue-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <MessageCircle size={20} strokeWidth={activeTab === AppTab.CHAT ? 3 : 2} />
                <span className="text-[9px] font-bold">Talk</span>
            </button>

            {/* 3. Stories */}
            <button
                onClick={() => handleTabChange(AppTab.SONGS)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-14 ${
                    activeTab === AppTab.SONGS 
                    ? 'text-green-500 bg-green-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <Library size={20} strokeWidth={activeTab === AppTab.SONGS ? 3 : 2} />
                <span className="text-[9px] font-bold text-center leading-tight">Stories</span>
            </button>

            {/* 4. Game */}
            <button
                onClick={() => handleTabChange(AppTab.GAME)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-14 ${
                    activeTab === AppTab.GAME 
                    ? 'text-yellow-500 bg-yellow-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <Gamepad2 size={20} strokeWidth={activeTab === AppTab.GAME ? 3 : 2} />
                <span className="text-[9px] font-bold">Game</span>
            </button>

            {/* 5. Book Tool */}
            <button
                onClick={() => handleTabChange(AppTab.EBOOKS)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-14 ${
                    activeTab === AppTab.EBOOKS 
                    ? 'text-purple-500 bg-purple-50 -translate-y-2 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <FileType size={20} strokeWidth={activeTab === AppTab.EBOOKS ? 3 : 2} />
                <span className="text-[9px] font-bold text-center leading-tight">Book Tool</span>
            </button>

        </div>
      </nav>
    </div>
  );
};

export default App;