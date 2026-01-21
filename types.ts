
export interface ExtractedDocument {
  id: string;
  fileName: string;
  sender: string;
  recipient: string;
  date: string;
  summary: string;
  content: string;
  topics: string[];
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
