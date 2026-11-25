import words from '../data/words.json';
import type { Grade, Level, Word } from './types';

/** The whole word bank, in file order. */
export const WORDS: readonly Word[] = words as unknown as readonly Word[];

const BY_ID = new Map(WORDS.map(w => [w.id, w]));

/** Grade 3 learns level 1 words, grade 6 level 4. */
export function levelForGrade(grade: Grade): Level {
  return (grade - 2) as Level;
}

export function wordsUpToLevel(level: Level): Word[] {
  return WORDS.filter(w => w.level <= level);
}

export function wordById(id: string): Word | undefined {
  return BY_ID.get(id);
}
