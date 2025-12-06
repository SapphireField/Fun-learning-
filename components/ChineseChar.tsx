import React, { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';

interface ChineseCharProps {
  char: string;
  pinyin: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isActive?: boolean;
  onPlayAudio?: (char: string) => Promise<void>;
}

const ChineseChar: React.FC<ChineseCharProps> = ({ char, pinyin, size = 'md', isActive = false, onPlayAudio }) => {
  const [showPinyin, setShowPinyin] = useState(true);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const sizeClasses = {
    sm: { text: 'text-xl', pinyin: 'text-xs', icon: 12 },
    md: { text: 'text-3xl', pinyin: 'text-sm', icon: 14 },
    lg: { text: 'text-4xl', pinyin: 'text-base', icon: 16 },
    xl: { text: 'text-6xl', pinyin: 'text-xl', icon: 20 },
  };

  const currentSize = sizeClasses[size];
  const isPunctuation = !pinyin || pinyin.trim() === '';

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling pinyin
    if (onPlayAudio && !isLoadingAudio) {
        setIsLoadingAudio(true);
        try {
            await onPlayAudio(char);
        } finally {
            setIsLoadingAudio(false);
        }
    }
  };

  // If it's punctuation, simply render the character nicely aligned
  if (isPunctuation) {
    return (
        <div className={`flex flex-col items-center justify-end mx-0.5 my-1 h-full select-none transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>
             <span className={`${currentSize.text} text-gray-800 font-medium leading-none mb-1 opacity-70`}>{char}</span>
        </div>
    );
  }

  return (
    <div 
        className={`flex flex-col items-center mx-1 my-1 cursor-pointer select-none transition-all duration-300 relative group
        ${isActive ? 'scale-110 -translate-y-1' : 'active:scale-95'}`} 
        onClick={() => setShowPinyin(!showPinyin)}
        title="Tap to toggle Pinyin"
    >
      <span 
        className={`font-bold ${currentSize.pinyin} mb-[-4px] transition-opacity duration-200 ${
            isActive ? 'text-orange-600' : 'text-gray-500'
        } ${showPinyin ? 'opacity-100' : 'opacity-0'}`}
        style={{ visibility: showPinyin ? 'visible' : 'hidden' }}
      >
        {pinyin}
      </span>
      <span 
        className={`chinese-font ${currentSize.text} font-medium leading-none transition-colors duration-200 ${
            isActive ? 'text-orange-500 drop-shadow-sm' : 'text-gray-800'
        }`}
      >
        {char}
      </span>

      {/* Audio Button - Shows on hover or if active */}
      {onPlayAudio && (
          <button
            onClick={handlePlayClick}
            className={`absolute -top-1 -right-2 p-1 rounded-full bg-white shadow-sm border border-orange-100 text-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all z-10
            ${isLoadingAudio ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} lg:opacity-0 lg:group-hover:opacity-100`}
            title="Play sound"
          >
            {isLoadingAudio ? (
                <Loader2 size={currentSize.icon} className="animate-spin" />
            ) : (
                <Volume2 size={currentSize.icon} />
            )}
          </button>
      )}
    </div>
  );
};

export default ChineseChar;