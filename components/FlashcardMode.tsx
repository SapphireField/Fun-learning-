import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Volume2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PinyinChar } from '../types';
import { generateSpeech } from '../services/geminiService';
import { playPCM } from '../utils/audio';

interface FlashcardModeProps {
  data: PinyinChar[];
  onClose: () => void;
  title?: string;
}

const FlashcardMode: React.FC<FlashcardModeProps> = ({ data, onClose, title = "Flashcards" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [reviewList, setReviewList] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const currentCard = data[currentIndex];

  const handleNext = (known: boolean) => {
    if (known) setKnownCount(prev => prev + 1);
    else setReviewList(prev => [...prev, currentIndex]);

    setIsFlipped(false);
    
    if (currentIndex < data.length - 1) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 200);
    } else {
      setIsComplete(true);
    }
  };

  const playAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAudioLoading(true);
    try {
        const audio = await generateSpeech(currentCard.char, 'speech');
        if (audio) await playPCM(audio);
    } finally {
        setAudioLoading(false);
    }
  };

  const restart = () => {
      setCurrentIndex(0);
      setKnownCount(0);
      setReviewList([]);
      setIsComplete(false);
      setIsFlipped(false);
  };

  if (isComplete) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-6 bg-blue-50 text-center animate-in zoom-in">
              <h2 className="text-3xl font-black text-gray-800 mb-6">Session Complete!</h2>
              <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-200 mb-8 w-full max-w-sm">
                  <div className="text-6xl font-black text-blue-500 mb-2">{knownCount}</div>
                  <p className="text-gray-400 font-bold uppercase">Words Mastered</p>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                      <span>Total: {data.length}</span>
                      <span>Review: {reviewList.length}</span>
                  </div>
              </div>
              <div className="flex gap-4 w-full max-w-sm">
                  <button onClick={restart} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-md hover:bg-blue-600 flex items-center justify-center">
                      <RotateCcw className="mr-2" size={18}/> Restart
                  </button>
                  <button onClick={onClose} className="flex-1 py-3 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300">
                      Done
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
        {/* Header */}
        <div className="bg-white p-4 shadow-sm flex justify-between items-center z-10">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-medium">Exit</button>
            <h3 className="font-bold text-gray-700">{title}</h3>
            <div className="text-sm font-bold text-blue-500">{currentIndex + 1} / {data.length}</div>
        </div>

        {/* Card Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 perspective-1000">
            <div 
                className={`relative w-full max-w-sm aspect-[3/4] transition-all duration-500 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border-b-8 border-blue-200 flex flex-col items-center justify-center p-8">
                    <span className="text-sm text-gray-400 font-bold uppercase mb-4 tracking-wider">English</span>
                    <h2 className="text-5xl font-black text-gray-800 text-center break-words leading-tight">{currentCard.char}</h2>
                    <button 
                        onClick={playAudio} 
                        className="mt-8 p-4 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 transition-colors shadow-sm"
                    >
                        {audioLoading ? <Loader2 className="animate-spin" /> : <Volume2 size={32} />}
                    </button>
                    <p className="absolute bottom-6 text-gray-400 text-sm animate-pulse">Tap to flip</p>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden bg-blue-500 text-white rounded-3xl shadow-xl border-b-8 border-blue-700 flex flex-col items-center justify-center p-8 rotate-y-180" style={{ transform: 'rotateY(180deg)' }}>
                    <span className="text-sm text-blue-200 font-bold uppercase mb-4 tracking-wider">Meaning</span>
                    <h2 className="text-4xl font-bold text-center mb-2">{currentCard.pinyin}</h2>
                    {/* If we had pronunciation/IPA it would go here */}
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="p-6 pb-8 flex justify-center gap-6 bg-white border-t border-gray-100">
            <button 
                onClick={() => handleNext(false)}
                className="flex-1 max-w-[140px] py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-bold flex flex-col items-center hover:bg-red-100 hover:border-red-200 active:scale-95 transition-all"
            >
                <XCircle className="mb-1" />
                Review
            </button>
            <button 
                onClick={() => handleNext(true)}
                className="flex-1 max-w-[140px] py-4 rounded-2xl border-2 border-green-100 bg-green-50 text-green-600 font-bold flex flex-col items-center hover:bg-green-100 hover:border-green-200 active:scale-95 transition-all"
            >
                <CheckCircle2 className="mb-1" />
                Known
            </button>
        </div>
    </div>
  );
};

export default FlashcardMode;
