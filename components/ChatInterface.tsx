import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Volume2, StopCircle, Loader2, Square } from 'lucide-react';
import { chatWithPanda, generateSpeech } from '../services/geminiService';
import { playPCM, stopAudio, calculateWeightedActiveIndex } from '../utils/audio';
import { Message, ChatResponse, PinyinChar } from '../types';
import ChineseChar from './ChineseChar';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      timestamp: Date.now(),
      data: {
        chinese: "你好！我是你的中文老师。",
        english: "Hello! I am your Chinese teacher.",
        aligned: [
            { char: "你", pinyin: "nǐ" },
            { char: "好", pinyin: "hǎo" },
            { char: "！", pinyin: "" },
            { char: "我", pinyin: "wǒ" },
            { char: "是", pinyin: "shì" },
            { char: "你", pinyin: "nǐ" },
            { char: "的", pinyin: "de" },
            { char: "中", pinyin: "zhōng" },
            { char: "文", pinyin: "wén" },
            { char: "老", pinyin: "lǎo" },
            { char: "师", pinyin: "shī" },
            { char: "。", pinyin: "" }
        ]
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Animation Refs
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const requestRef = useRef<number>();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        stopAudio();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN'; // Default to Chinese listening for practice

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    handleStopGlobal();
    
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleStopGlobal = () => {
    stopAudio();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setPlayingAudioId(null);
    setPlaybackProgress(0);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    // Stop any playing audio
    handleStopGlobal();

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Prepare history for API
    const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.sender === 'user' ? (m.content || '') : (m.data?.chinese || '') }]
    }));

    try {
        const response = await chatWithPanda(userMsg.content || '', history);

        const botMsgId = (Date.now() + 1).toString();
        const botMsg: Message = {
            id: botMsgId,
            sender: 'bot',
            data: response,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, botMsg]);
        setIsLoading(false);
        
        // Auto-speak the response
        handlePlayAudio(response.chinese, botMsgId);
    } catch (error) {
        setIsLoading(false);
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
       setPlayingAudioId(null);
    }
  };

  const handlePlayAudio = async (text: string, messageId: string) => {
    // If clicking the same message that is playing, stop it
    if (playingAudioId === messageId) {
        handleStopGlobal();
        return;
    }

    handleStopGlobal();
    setPlayingAudioId(messageId);
    
    try {
      // Use default 'speech' style
      const base64Audio = await generateSpeech(text, 'speech');
      if (base64Audio) {
        await playPCM(base64Audio, (duration) => {
            durationRef.current = duration;
            startTimeRef.current = Date.now();
            requestRef.current = requestAnimationFrame(animate);
        });
      }
    } catch (e) {
      console.error("Failed to play audio", e);
      setPlayingAudioId(null);
    }
  };

  const renderBotMessage = (data: ChatResponse, msgId: string) => {
    const isThisPlaying = playingAudioId === msgId;
    const activeIndex = isThisPlaying ? calculateWeightedActiveIndex(playbackProgress, data.aligned) : -1;

    return (
        <div className="flex flex-col">
           <div className="flex flex-wrap items-end mb-2">
              {data.aligned.map((item, idx) => (
                  <ChineseChar 
                    key={idx}
                    char={item.char}
                    pinyin={item.pinyin}
                    size="sm"
                    isActive={isThisPlaying && idx === activeIndex}
                  />
              ))}
              <button 
                onClick={() => handlePlayAudio(data.chinese, msgId)} 
                className={`transition-colors p-2 rounded-full ml-2 mb-1 ${
                    isThisPlaying 
                    ? 'bg-orange-100 text-orange-500 hover:bg-orange-200' 
                    : 'text-orange-400 hover:text-orange-600 hover:bg-gray-50'
                }`}
              >
                {isThisPlaying ? (
                    <Square size={16} className="fill-current"/>
                ) : <Volume2 size={20} />}
              </button>
           </div>
           
           <div className="mt-1 pt-2 border-t border-gray-100">
             <p className="text-gray-500 text-sm italic">{data.english}</p>
           </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 max-w-md mx-auto w-full relative">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm border-b border-gray-100 z-10 flex items-center justify-between">
        <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-2xl">🐼</span>
            </div>
            <div>
                <h2 className="font-bold text-gray-800">Teacher Panda</h2>
                <p className="text-xs text-green-500 font-bold flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span> Online
                </p>
            </div>
        </div>
        
        {/* Global Stop Button */}
        {playingAudioId && (
            <button 
                onClick={handleStopGlobal}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 rounded-full text-sm font-bold hover:bg-red-200 transition-all shadow-sm animate-in fade-in"
            >
                <Square size={14} className="fill-current" /> Stop
            </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-white border-2 border-orange-100 rounded-bl-none'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="text-lg chinese-font font-medium">{msg.content}</p>
              ) : (
                msg.data && renderBotMessage(msg.data, msg.id)
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white border-2 border-orange-100 rounded-2xl rounded-bl-none p-4 shadow-sm">
                    <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
            <button
                onClick={toggleListening}
                className={`p-3 rounded-full transition-all ${
                    isListening 
                    ? 'bg-red-100 text-red-500 animate-pulse' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
                {isListening ? <StopCircle size={24} /> : <Mic size={24} />}
            </button>
            
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isListening ? "Listening..." : "Say something..."}
                className="flex-1 bg-gray-100 rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-blue-200 transition-all chinese-font font-medium"
            />
            
            <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`p-3 rounded-full transition-all ${
                    input.trim() 
                    ? 'bg-blue-500 text-white shadow-md hover:scale-105' 
                    : 'bg-gray-200 text-gray-400'
                }`}
            >
                <Send size={24} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;