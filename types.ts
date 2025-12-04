export interface PinyinChar {
  char: string;
  pinyin: string;
}

export interface ChatResponse {
  chinese: string;
  english: string;
  aligned: PinyinChar[];
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  content?: string; // For user text
  data?: ChatResponse; // For bot structured response
  timestamp: number;
}

export interface QuizQuestion {
  question: string;
  pinyin: string;
  options: string[];
  correctAnswer: number; // index 0-3
  explanation: string;
}

export enum AppTab {
  LEARN = 'LEARN',
  CHAT = 'CHAT',
  SONGS = 'SONGS',
  EBOOKS = 'EBOOKS',
  GAME = 'GAME',
}