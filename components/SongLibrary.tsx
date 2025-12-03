import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Square, ArrowLeft, Loader2, Globe, Languages, Plus, Trash2, Search, BookOpen } from 'lucide-react';
import { convertToPinyin, generateSpeech, getSongLyrics } from '../services/geminiService';
import { playPCM, stopAudio, calculateWeightedActiveIndex } from '../utils/audio';
import { PinyinChar } from '../types';
import ChineseChar from './ChineseChar';
import { STATIC_LIBRARY_DATA } from '../data/libraryData';

interface LibraryItem {
  id: string;
  title: string;
  chineseTitle: string;
  color: string;
  content: string; // Lyrics or Story text
  englishContent: string;
  type: 'rhyme' | 'story';
  savedPinyinData?: PinyinChar[]; // Cache for pinyin conversion result
}

const DEFAULT_ITEMS: LibraryItem[] = [
  // Rhymes
  {
    id: 'star',
    title: 'Twinkle Twinkle Little Star',
    chineseTitle: '小星星',
    color: 'bg-yellow-400',
    content: '一闪一闪亮晶晶，满天都是小星星。挂在天上放光明，好像许多小眼睛。一闪一闪亮晶晶，满天都是小星星。',
    englishContent: 'Twinkle, twinkle, bright and clear. The sky is full of little stars. Hanging in the sky giving off light. Like many little eyes. Twinkle, twinkle, bright and clear. The sky is full of little stars.',
    type: 'rhyme'
  },
  {
    id: 'tigers',
    title: 'Two Tigers',
    chineseTitle: '两只老虎',
    color: 'bg-orange-400',
    content: '两只老虎，两只老虎，跑得快，跑得快。一只没有耳朵，一只没有尾巴，真奇怪，真奇怪。',
    englishContent: 'Two tigers, two tigers. Running fast, running fast. One has no ears. One has no tail. So strange, so strange.',
    type: 'rhyme'
  },
  {
    id: 'radish',
    title: 'Pull the Radish',
    chineseTitle: '拔萝卜',
    color: 'bg-green-400',
    content: '拔萝卜，拔萝卜。嘿哟嘿哟，拔萝卜，嘿哟嘿哟，拔不动。老太婆，快快来，快来帮我们拔萝卜。',
    englishContent: 'Pull the radish, pull the radish. Heave-ho, heave-ho, pull the radish. Heave-ho, heave-ho, cannot pull it out. Old woman, come quickly. Come help us pull the radish.',
    type: 'rhyme'
  },
  {
    id: 'rabbit',
    title: 'Little Rabbit Be Good',
    chineseTitle: '小兔子乖乖',
    color: 'bg-pink-400',
    content: '小兔子乖乖，把门儿开开！快点儿开开，我要进来。不开不开，我不开，妈妈没回来，谁来也不开！',
    englishContent: 'Little rabbit be good, open the door! Open it quickly, I want to come in. No no no, I won\'t open it. Mom hasn\'t come back, I won\'t open it for anyone!',
    type: 'rhyme'
  },
  {
    id: 'friend',
    title: 'Looking for a Friend',
    chineseTitle: '找朋友',
    color: 'bg-cyan-400',
    content: '找呀找呀找朋友，找到一个好朋友。敬个礼，握握手，你是我的好朋友。再见！',
    englishContent: 'Looking, looking for a friend, found a good friend. Salute, shake hands, you are my good friend. Goodbye!',
    type: 'rhyme'
  },
  // Stories
  {
    id: 'kongrong',
    title: 'Kong Rong Gives Pears',
    chineseTitle: '孔融让梨',
    color: 'bg-red-400',
    content: '古时候，有个孩子叫孔融。他四岁的时候，已经很懂事了。有一天，爸爸买了很多梨，让孩子们自己拿。孔融挑了一个最小的梨。爸爸问他：“你为什么不拿大的呢？”孔融说：“我年纪小，应该吃小的，大的留给哥哥吃。”大家都夸孔融是个好孩子。',
    englishContent: 'In ancient times, there was a child named Kong Rong. When he was four years old, he was already very sensible. One day, his father bought many pears and let the children take them. Kong Rong picked the smallest pear. His father asked him, "Why didn\'t you take a big one?" Kong Rong said, "I am young, I should eat the small one, and leave the big ones for my older brothers." Everyone praised Kong Rong for being a good child.',
    type: 'story'
  },
  {
    id: 'crow',
    title: 'The Crow Drinks Water',
    chineseTitle: '乌鸦喝水',
    color: 'bg-purple-400',
    content: '一只乌鸦口渴了，到处找水喝。它看见一个瓶子，瓶子里有水。可是瓶子很高，瓶口很小，里边的水又少，它喝不着。怎么办呢？乌鸦看见旁边有许多小石子。它把小石子一个一个地衔起来，放到瓶子里。瓶子里的水渐渐升高了，乌鸦就喝着水了。',
    englishContent: 'A crow was thirsty and looked for water everywhere. He saw a bottle with water in it. But the bottle was tall, the neck was narrow, and there was little water inside, so he couldn\'t reach it. What to do? The crow saw many small pebbles nearby. He picked up the pebbles one by one and put them into the bottle. The water in the bottle gradually rose, and the crow could drink the water.',
    type: 'story'
  }
];

const SongLibrary: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [contentData, setContentData] = useState<PinyinChar[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  
  // Custom Items State
  const [customItems, setCustomItems] = useState<LibraryItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);

  // Playback Refs
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const requestRef = useRef<number>();

  useEffect(() => {
    // Load custom items from local storage
    const saved = localStorage.getItem('customItems');
    if (saved) {
      try {
        setCustomItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom items");
      }
    }
    
    return () => {
      stopAudio();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const saveCustomItems = (items: LibraryItem[]) => {
      setCustomItems(items);
      localStorage.setItem('customItems', JSON.stringify(items));
  };

  const handleSelectItem = async (item: LibraryItem) => {
    setSelectedItem(item);
    stopAudio();
    setIsPlaying(false);
    setPlaybackProgress(0);
    setShowEnglish(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    // 1. Check if we have Static Data for built-in items
    if (STATIC_LIBRARY_DATA[item.id]) {
        setContentData(STATIC_LIBRARY_DATA[item.id]);
        return;
    }

    // 2. Check if we have cached pinyin data for custom items
    if (item.savedPinyinData && item.savedPinyinData.length > 0) {
        setContentData(item.savedPinyinData);
        return;
    }
    
    // 3. Convert content to Pinyin via API
    setLoading(true);
    const data = await convertToPinyin(item.content);
    setContentData(data);
    
    // Cache the result to the custom item so we don't need to fetch again
    if (!DEFAULT_ITEMS.find(i => i.id === item.id)) {
        const updatedCustomItems = customItems.map(ci => 
            ci.id === item.id ? { ...ci, savedPinyinData: data } : ci
        );
        saveCustomItems(updatedCustomItems);
    }
    
    setLoading(false);
  };

  const handleBack = () => {
    stopAudio();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setSelectedItem(null);
    setContentData([]);
    setPlaybackProgress(0);
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

  const togglePlay = async () => {
    if (isPlaying) {
      stopAudio();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setIsPlaying(false);
      setPlaybackProgress(0);
      return;
    }

    if (!selectedItem) return;

    setAudioLoading(true);
    // Request appropriate style: 'song' for rhymes, 'story' for stories
    const style = selectedItem.type === 'rhyme' ? 'song' : 'story';
    const base64Audio = await generateSpeech(selectedItem.content, style);
    setAudioLoading(false);

    if (base64Audio) {
      setIsPlaying(true);
      
      await playPCM(base64Audio, (duration) => {
          durationRef.current = duration;
          startTimeRef.current = Date.now();
          requestRef.current = requestAnimationFrame(animate);
      });
    }
  };

  const handleAddCustom = async () => {
    if (!searchTitle.trim()) return;
    
    setAddingLoading(true);
    
    try {
        // Fetch content using the title
        const result = await getSongLyrics(searchTitle);
        
        if (result) {
            const newItem: LibraryItem = {
                id: Date.now().toString(),
                title: searchTitle,
                chineseTitle: result.chineseTitle || searchTitle,
                color: 'bg-blue-400', // Default color for custom items
                content: result.content,
                englishContent: result.english,
                type: result.type as 'rhyme' | 'story' || 'rhyme'
            };
            
            const updatedCustom = [newItem, ...customItems];
            saveCustomItems(updatedCustom);
            
            setIsAdding(false);
            setSearchTitle('');
        } else {
            alert(`Could not find content for "${searchTitle}". Try a different title.`);
        }
    } catch (e) {
        console.error(e);
        alert("Error adding item");
    } finally {
        setAddingLoading(false);
    }
  };

  const deleteCustomItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this story from your history?")) {
        const updated = customItems.filter(s => s.id !== id);
        saveCustomItems(updated);
    }
  };

  // Helper to chunk content into lines based on punctuation
  // Now handles cases where punctuation is its own object
  const getLines = (data: PinyinChar[]) => {
    const lines: PinyinChar[][] = [];
    let currentLine: PinyinChar[] = [];
    // Common sentence ending punctuation in Chinese/English
    const breakPoints = ['。', '！', '？', '!', '?', '.', '\n', '；', ';', '：', ':'];

    data.forEach(item => {
      currentLine.push(item);
      // Check if this char is a break point
      if (breakPoints.includes(item.char)) {
        lines.push(currentLine);
        currentLine = [];
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.filter(line => line.length > 0);
  };

  // Use new weighted active index for sync
  const activeIndex = isPlaying ? calculateWeightedActiveIndex(playbackProgress, contentData) : -1;

  let charCounter = 0;

  // Detail View
  if (selectedItem) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto w-full bg-orange-50">
        
        {/* Fixed Header */}
        <div className="flex-none p-4 pb-2 z-20">
          <button 
            onClick={handleBack}
            className="flex items-center text-gray-600 font-bold hover:text-orange-500 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" /> Back
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 no-scrollbar">
            
            {/* Title Card */}
            <div className={`rounded-3xl shadow-xl p-6 border-4 border-white mb-6 text-white relative overflow-hidden ${selectedItem.color} flex-shrink-0 transition-transform`}>
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-20 rounded-full blur-2xl"></div>
                {selectedItem.type === 'story' ? <BookOpen size={48} className="mb-4 opacity-80"/> : <Music size={48} className="mb-4 opacity-80" />}
                <h2 className="text-4xl font-black chinese-font mb-1">{selectedItem.chineseTitle}</h2>
                <p className="font-bold opacity-90">{selectedItem.title}</p>
                <div className="absolute top-4 right-4 bg-white/20 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                    {selectedItem.type === 'story' ? 'Story' : 'Rhyme'}
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-6 border-2 border-gray-100 mb-6 mt-2">
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <Loader2 size={40} className="animate-spin mb-2 text-orange-400" />
                        <p>Preparing magic...</p>
                    </div>
                ) : (
                    <>
                       <div className="flex justify-between items-center mb-6">
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => setShowEnglish(false)}
                                 className={`p-2 rounded-xl transition-colors ${!showEnglish ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                 title="Chinese"
                               >
                                 <Languages size={20} />
                               </button>
                               <button 
                                 onClick={() => setShowEnglish(true)}
                                 className={`p-2 rounded-xl transition-colors ${showEnglish ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                 title="English"
                               >
                                 <Globe size={20} />
                               </button>
                            </div>
                            
                            <button
                                onClick={togglePlay}
                                disabled={audioLoading}
                                className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold shadow-md transition-all active:scale-95 ${
                                    isPlaying 
                                    ? 'bg-red-500 text-white hover:bg-red-600' 
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {audioLoading ? <Loader2 className="animate-spin" size={20} /> : isPlaying ? <Square size={16} className="fill-current"/> : <Play size={20} className="fill-current" />}
                                {isPlaying ? 'Stop' : 'Listen'}
                            </button>
                       </div>
                       
                       <div className="min-h-[200px]">
                         {!showEnglish ? (
                            <div className="flex flex-col items-center w-full">
                                {getLines(contentData).map((line, i) => (
                                    <div key={i} className={`flex flex-wrap ${selectedItem.type === 'story' ? 'justify-start' : 'justify-center'} mb-3 w-full px-2 py-1 bg-orange-50/50 rounded-xl`}>
                                        {line.map((item, index) => {
                                            const currentGlobalIndex = charCounter;
                                            const isActive = activeIndex === currentGlobalIndex;
                                            charCounter++;
                                            return (
                                                <ChineseChar 
                                                    key={`${i}-${index}-${item.char}`} 
                                                    char={item.char} 
                                                    pinyin={item.pinyin} 
                                                    size="lg" 
                                                    isActive={isActive}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                         ) : (
                            <div className="p-4">
                                <p className="text-lg text-gray-700 leading-relaxed font-medium">
                                    {selectedItem.englishContent}
                                </p>
                            </div>
                         )}
                       </div>
                    </>
                )}
            </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar pb-24">
      <div className="mb-6 mt-2 flex justify-between items-end">
         <div>
            <h2 className="text-3xl font-black text-gray-800 flex items-center">
                <span className="bg-orange-100 p-2 rounded-xl mr-3 text-orange-500">📚</span>
                Library
            </h2>
            <p className="text-gray-400 ml-14 mt-1">Rhymes & Stories</p>
         </div>
         <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-2 bg-gray-100 rounded-full hover:bg-orange-100 text-gray-500 hover:text-orange-500 transition-colors"
         >
            <Plus size={24} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'}/>
         </button>
      </div>

      {isAdding && (
          <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-orange-200 mb-6 animate-in slide-in-from-top-4 fade-in">
             <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Search size={18} className="mr-2 text-orange-500"/> Add New</h3>
             <input 
                className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Title (e.g., Kong Rong Gives Pears)"
                value={searchTitle}
                onChange={e => setSearchTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
             />
             <div className="flex justify-end gap-2">
                 <button 
                    onClick={() => setIsAdding(false)} 
                    className="px-4 py-2 text-gray-500 text-sm hover:bg-gray-100 rounded-lg"
                 >
                    Cancel
                 </button>
                 <button 
                    onClick={handleAddCustom}
                    disabled={addingLoading || !searchTitle}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 flex items-center"
                 >
                    {addingLoading && <Loader2 className="animate-spin mr-2" size={14}/>}
                    Search & Add
                 </button>
             </div>
          </div>
      )}

      <div className="space-y-4">
        {/* Built-in Items */}
        {DEFAULT_ITEMS.map((item) => (
            <div 
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="bg-white rounded-2xl p-4 shadow-sm border-2 border-transparent hover:border-orange-200 hover:shadow-md transition-all cursor-pointer flex items-center group"
            >
                <div className={`w-16 h-16 rounded-xl ${item.color} flex items-center justify-center text-white mr-4 shadow-sm group-hover:scale-110 transition-transform flex-shrink-0 relative`}>
                    {item.type === 'story' ? <BookOpen size={28} /> : <Music size={28} />}
                </div>
                <div className="overflow-hidden">
                    <h3 className="text-xl font-bold text-gray-800 chinese-font truncate">{item.chineseTitle}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{item.type}</span>
                        <p className="text-gray-500 text-sm truncate">{item.title}</p>
                    </div>
                </div>
                <div className="ml-auto w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-500 transition-colors flex-shrink-0">
                    <Play size={20} className="ml-1" />
                </div>
            </div>
        ))}

        {/* Custom Items Header if exists */}
        {customItems.length > 0 && (
             <h3 className="text-gray-500 font-bold px-2 pt-2 pb-1 text-sm uppercase tracking-wider">Recently Added</h3>
        )}

        {/* Custom Items */}
        {customItems.map((item) => (
            <div 
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="bg-white rounded-2xl p-4 shadow-sm border-2 border-transparent hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center group"
            >
                <div className={`w-16 h-16 rounded-xl bg-blue-400 flex items-center justify-center text-white mr-4 shadow-sm group-hover:scale-110 transition-transform flex-shrink-0 relative overflow-hidden`}>
                     {item.type === 'story' ? <BookOpen size={28} /> : <Music size={28} />}
                </div>
                <div className="overflow-hidden flex-1">
                    <h3 className="text-xl font-bold text-gray-800 chinese-font truncate">{item.chineseTitle}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{item.type}</span>
                        <p className="text-gray-500 text-sm truncate">{item.title}</p>
                    </div>
                </div>
                <button
                    onClick={(e) => deleteCustomItem(e, item.id)}
                    className="ml-2 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors flex-shrink-0 z-10"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ))}
        
        {customItems.length === 0 && DEFAULT_ITEMS.length > 0 && (
             <div className="text-center py-8 text-gray-400 border-t border-gray-100 mt-8">
                 <p className="text-sm">Tap the + button to search and add more stories!</p>
             </div>
        )}
      </div>
    </div>
  );
};

export default SongLibrary;