export interface PinyinChar {
  char: string;
  pinyin: string;
}

export interface ChatResponse {
  chinese: string;
  pinyin: string;
  english: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  content?: string; // For user text
  data?: ChatResponse; // For bot structured response
  timestamp: number;
}

export enum AppTab {
  LEARN = 'LEARN',
  CHAT = 'CHAT',
  SONGS = 'SONGS',
  EBOOKS = 'EBOOKS',
}