export type Grade = 3 | 4 | 5 | 6;
export type Level = 1 | 2 | 3 | 4;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameId = 'letter-balloons' | 'listen-catch' | 'word-object';
export type Category = 'animals' | 'food' | 'home' | 'tools' | 'clothes' | 'body' | 'school' | 'transport';

export interface Word {
  id: string;
  en: string;
  he: string;
  image: string;
  audio: string;
  category: Category;
  level: Level;
  trap?: string;
  confusableWith?: string[];
}

export interface Profile {
  id: string;
  name: string;
  grade: Grade;
  avatar: string;
  createdAt: number;
}

export interface WordProgress {
  box: 1 | 2 | 3;
  lastSeenRound: number;
}

export interface RoundItem {
  wordId: string;
  firstTry: boolean;
}

export interface RoundResult {
  game: GameId;
  difficulty: Difficulty;
  items: RoundItem[];
  stars: 1 | 2 | 3;
}
