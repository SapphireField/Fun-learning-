import React, { useState } from 'react';

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
    sm: { text: 'text-xl', pinyin: 'text-xs', minHeight: 'min-h-[16px]' },
    md: { text: 'text-3xl', pinyin: 'text-sm', minHeight: 'min-h-[20px]' },
    lg: { text: 'text-4xl', pinyin: 'text-base', minHeight: 'min-h-[24px]' },
    xl: { text: 'text-6xl', pinyin: 'text-xl', minHeight: 'min-h-[28px]' },
  };

  const currentSize = sizeClasses[size];
  const isPunctuation = !pinyin || pinyin.trim() === '';

  const handleCharClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bubbling if nested
    if (onPlayAudio && !isLoadingAudio) {
        setIsLoadingAudio(true);
        try {
            await onPlayAudio(char);
        } finally {
            setIsLoadingAudio(false);
        }
    }
  };

  const handlePinyinClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowPinyin(!showPinyin);
  };

  // If it's punctuation, simply render the character nicely aligned
  if (isPunctuation) {
    return (
        <div className={`flex flex-col items-center justify-end mx-0.5 my-1 h-full select-none transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>
             <div className={`${currentSize.minHeight} mb-[-4px]`}></div>
             <span className={`${currentSize.text} text-gray-800 font-medium leading-none mb-1 opacity-70`}>{char}</span>
        </div>
    );
  }

  return (
    <div 
        className={`flex flex-col items-center mx-1 my-1 cursor-pointer select-none transition-all duration-300 relative group
        ${isActive ? 'scale-110 -translate-y-1' : 'active:scale-95'}
        ${isLoadingAudio ? 'opacity-70' : ''}`} 
    >
      {/* Pinyin Container - Always clickable even if hidden */}
      <div 
        className={`${currentSize.minHeight} w-full flex items-center justify-center mb-[-4px] z-10`}
        onClick={handlePinyinClick}
      >
        <span 
            className={`font-bold ${currentSize.pinyin} transition-opacity duration-200 hover:text-orange-600 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
            } ${showPinyin ? 'opacity-100' : 'opacity-0'}`}
        >
            {pinyin}
        </span>
      </div>

      {/* Character Container - Plays audio */}
      <div onClick={handleCharClick} className="w-full text-center">
        <span 
            className={`chinese-font ${currentSize.text} font-medium leading-none transition-colors duration-200 ${
                isActive || isLoadingAudio ? 'text-orange-500 drop-shadow-sm' : 'text-gray-800'
            }`}
        >
            {char}
        </span>
      </div>
    </div>
  );
};

export default ChineseChar;