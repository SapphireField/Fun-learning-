import React, { useState, useEffect } from 'react';

interface ChineseCharProps {
  char: string;
  pinyin: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isActive?: boolean;
}

const ChineseChar: React.FC<ChineseCharProps> = ({ char, pinyin, size = 'md', isActive = false }) => {
  const [showPinyin, setShowPinyin] = useState(true);

  const sizeClasses = {
    sm: { text: 'text-xl', pinyin: 'text-xs' },
    md: { text: 'text-3xl', pinyin: 'text-sm' },
    lg: { text: 'text-4xl', pinyin: 'text-base' },
    xl: { text: 'text-6xl', pinyin: 'text-xl' },
  };

  const currentSize = sizeClasses[size];
  const isPunctuation = !pinyin || pinyin.trim() === '';

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
        className={`flex flex-col items-center mx-1 my-1 cursor-pointer select-none transition-all duration-300 ${isActive ? 'scale-110 -translate-y-1' : 'active:scale-95'}`} 
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
    </div>
  );
};

export default ChineseChar;