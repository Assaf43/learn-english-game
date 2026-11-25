import { shuffle, type Rng } from '../../core/rng';
import type { Difficulty, RoundItem, Word } from '../../core/types';

export interface LBConfig {
  /** Word length for this level. The range widens when it holds too few words. */
  minLen: number;
  maxLen: number;
  /** Fewest and most extra letters that do not belong to the word. */
  distractors: [number, number];
  /** Extra letters are look-alikes of the word's letters (b/d, m/n). */
  confusable: boolean;
  firstLetterGiven: boolean;
  uppercase: boolean;
  /** The word is spoken when it starts. */
  autoAudio: boolean;
  /** How fast balloons rise, in px per second. */
  speed: number;
}

export const LB_CONFIG: Record<Difficulty, LBConfig> = {
  easy: { minLen: 3, maxLen: 4, distractors: [0, 0], confusable: false, firstLetterGiven: true, uppercase: true, autoAudio: true, speed: 40 },
  medium: { minLen: 4, maxLen: 6, distractors: [2, 3], confusable: false, firstLetterGiven: false, uppercase: false, autoAudio: true, speed: 55 },
  hard: { minLen: 5, maxLen: 8, distractors: [3, 4], confusable: true, firstLetterGiven: false, uppercase: false, autoAudio: false, speed: 55 },
};

/** Letters that children mix up with each other. */
export const CONFUSABLE: Record<string, string[]> = {
  b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'q', 'd'], q: ['p'], i: ['e'], e: ['i', 'a'], a: ['e', 'u'], u: ['a'],
  c: ['k'], k: ['c'], m: ['n'], n: ['m'], v: ['w'], w: ['v'], s: ['z'], z: ['s'],
};

export const ROUND_SIZE = 6;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Words whose length fits the level. The range widens by one letter each side until it holds a full round. */
export function candidatesForLength(words: readonly Word[], cfg: LBConfig): Word[] {
  const longest = Math.max(0, ...words.map(w => w.en.length));
  let min = cfg.minLen;
  let max = cfg.maxLen;
  for (;;) {
    const fitting = words.filter(w => w.en.length >= min && w.en.length <= max);
    if (fitting.length >= ROUND_SIZE || (min <= 1 && max >= longest)) return fitting;
    min -= 1;
    max += 1;
  }
}

/**
 * Extra letters to float among the word's own: never a letter of the word, never twice the same.
 * On a `confusable` level the look-alikes of the word's letters come first;
 * on other levels look-alikes are left out, so the extra letters are clearly different.
 */
export function distractorLetters(word: string, cfg: LBConfig, rng: Rng): string[] {
  const [fewest, most] = cfg.distractors;
  const count = fewest + Math.floor(rng() * (most - fewest + 1));
  const inWord = new Set(word.toLowerCase());
  const lookAlikes = new Set([...inWord].flatMap(letter => CONFUSABLE[letter] ?? []).filter(letter => !inWord.has(letter)));
  const plain = shuffle(ALPHABET.filter(letter => !inWord.has(letter) && !lookAlikes.has(letter)), rng);
  const ordered = cfg.confusable ? [...shuffle([...lookAlikes], rng), ...plain] : plain;
  return ordered.slice(0, count);
}

/** One try at spelling a word by popping its letters in order. */
export class WordAttempt {
  private readonly letters: string;
  private position: number;
  private wrongTotal = 0;
  private wrongOnThisLetter = 0;
  private hintUsed = false;
  private hintOnThisLetter = false;

  constructor(word: string, cfg: LBConfig) {
    this.letters = word.toLowerCase();
    this.position = cfg.firstLetterGiven ? Math.min(1, this.letters.length) : 0;
  }

  /** The letters placed so far. */
  filled(): string {
    return this.letters.slice(0, this.position);
  }

  nextLetter(): string | null {
    return this.done() ? null : this.letters[this.position];
  }

  pop(letter: string): 'correct' | 'wrong' | 'ignored' {
    if (this.done()) return 'ignored';
    if (letter.toLowerCase() !== this.letters[this.position]) {
      this.wrongTotal += 1;
      this.wrongOnThisLetter += 1;
      return 'wrong';
    }
    this.position += 1;
    this.wrongOnThisLetter = 0;
    this.hintOnThisLetter = false;
    return 'correct';
  }

  useHint(): void {
    if (this.done()) return;
    this.hintUsed = true;
    this.hintOnThisLetter = true;
  }

  /** The next correct balloon should glow: a hint was used on this letter, or it was missed twice. */
  shouldGlow(): boolean {
    return !this.done() && (this.hintOnThisLetter || this.wrongOnThisLetter >= 2);
  }

  done(): boolean {
    return this.position >= this.letters.length;
  }

  /** Spelled without a hint and with at most one wrong pop in the whole word. */
  clean(): boolean {
    return !this.hintUsed && this.wrongTotal <= 1;
  }
}

/** The order of words in a round: each word once, then every word that was not clean once more. */
export class BalloonRound {
  private readonly words: string[];
  private readonly cleanFirst = new Map<string, boolean>();
  private readonly cleanRetry = new Map<string, boolean>();
  private retries: string[] | null = null;
  private index = 0;

  constructor(words: readonly string[]) {
    this.words = [...new Set(words)];
  }

  /** The word to play now, or null when the round is finished. */
  current(): string | null {
    return (this.retries ?? this.words)[this.index] ?? null;
  }

  /** Ends the current word. */
  complete(clean: boolean): void {
    const word = this.current();
    if (word === null) return;
    (this.retries ? this.cleanRetry : this.cleanFirst).set(word, clean);
    this.index += 1;
    if (!this.retries && this.index >= this.words.length) {
      this.retries = this.words.filter(w => this.cleanFirst.get(w) !== true);
      this.index = 0;
    }
  }

  /** The current word is being played for the second time. */
  isRetry(): boolean {
    return this.retries !== null && this.current() !== null;
  }

  /** Words spelled clean, on the first try or on the retry. */
  cleanCount(): number {
    return this.words.filter(w => this.cleanFirst.get(w) === true || this.cleanRetry.get(w) === true).length;
  }

  /** One result per word. `firstTry` is about the first attempt only. */
  items(): RoundItem[] {
    return this.words.map(wordId => ({ wordId, firstTry: this.cleanFirst.get(wordId) === true }));
  }
}

/**
 * The letter of the next balloon to enter: the needed letter whenever it is not
 * on screen, otherwise the next queued letter. So the letter the child needs
 * is always on screen or the very next to appear.
 */
export function nextSpawn(needed: string | null, onScreen: readonly string[], queue: readonly string[]): string | null {
  if (needed !== null && !onScreen.includes(needed)) return needed;
  return queue[0] ?? null;
}

/** Ignores a second tap on the same balloon within a short time, so a double tap or two fingers count once. */
export class TapGuard {
  private readonly windowMs: number;
  private readonly lastTap = new Map<number, number>();

  constructor(windowMs = 400) {
    this.windowMs = windowMs;
  }

  accept(balloonId: number, now: number): boolean {
    const last = this.lastTap.get(balloonId);
    if (last !== undefined && now - last < this.windowMs) return false;
    this.lastTap.set(balloonId, now);
    return true;
  }
}
