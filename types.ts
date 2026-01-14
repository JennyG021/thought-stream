
export interface Thought {
  id: string;
  content: string;
  timestamp: Date;
  images: string[]; // Base64 strings
  analysis?: ThoughtAnalysis;
  aiQuestions?: string[];
}

export interface ThoughtAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  tags: string[];
  summary: string;
}

export enum AppView {
  TIMELINE = 'timeline',
  CALENDAR = 'calendar',
  INSIGHTS = 'insights'
}
