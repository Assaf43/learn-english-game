import { expect, test } from 'vitest';
import { mulberry32 } from '../../src/core/rng';
import type { Word } from '../../src/core/types';
import { WORDS, wordsUpToLevel } from '../../src/core/wordbank';
import {
  BalloonRound, CONFUSABLE, LB_CONFIG, ROUND_SIZE, TapGuard, WordAttempt,
  candidatesForLength, distractorLetters, nextSpawn,
} from '../../src/games/letter-balloons/logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i);

function word(en: string): Word {
  return { id: en, en, he: en, image: `img/words/${en}.svg`, audio: `audio/${en}.mp3`, category: 'animals', level: 1 };
}
function popAll(attempt: WordAttempt, letters: string): void {
  for (const letter of letters) expect(attempt.pop(letter)).toBe('correct');
}

test('the settings for each difficulty are the ones in the plan', () => {
  expect(LB_CONFIG).toEqual({
    easy: { minLen: 3, maxLen: 4, distractors: [0, 0], confusable: false, firstLetterGiven: true, uppercase: true, autoAudio: true, speed: 40 },
    medium: { minLen: 4, maxLen: 6, distractors: [2, 3], confusable: false, firstLetterGiven: false, uppercase: false, autoAudio: true, speed: 55 },
    hard: { minLen: 5, maxLen: 8, distractors: [3, 4], confusable: true, firstLetterGiven: false, uppercase: false, autoAudio: false, speed: 55 },
  });
  expect(ROUND_SIZE).toBe(6);
  expect(CONFUSABLE).toEqual({
    b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'q', 'd'], q: ['p'], i: ['e'], e: ['i', 'a'], a: ['e', 'u'], u: ['a'],
    c: ['k'], k: ['c'], m: ['n'], n: ['m'], v: ['w'], w: ['v'], s: ['z'], z: ['s'],
  });
});

test('pop: correct letters fill in order; wrong letter does not advance', () => {
  const a = new WordAttempt('cat', LB_CONFIG.medium);
  expect(a.nextLetter()).toBe('c');
  expect(a.pop('a')).toBe('wrong');
  expect(a.filled()).toBe('');
  expect(a.pop('c')).toBe('correct');
  expect(a.filled()).toBe('c');
  expect(a.nextLetter()).toBe('a');
});

test('easy starts with the first letter filled', () => {
  const a = new WordAttempt('cat', LB_CONFIG.easy);
  expect(a.filled()).toBe('c');
  expect(a.nextLetter()).toBe('a');
});

test('a capital letter on a balloon counts as the same letter', () => {
  const a = new WordAttempt('cat', LB_CONFIG.easy);
  expect(a.pop('A')).toBe('correct');
  expect(a.filled()).toBe('ca');
});

test('double letters need two pops', () => {
  const a = new WordAttempt('apple', LB_CONFIG.medium);
  popAll(a, 'ap');
  expect(a.done()).toBe(false);
  expect(a.nextLetter()).toBe('p');
  popAll(a, 'ple');
  expect(a.done()).toBe(true);
  expect(a.filled()).toBe('apple');
  expect(a.nextLetter()).toBeNull();
});

test('clean: one wrong pop is still clean, two are not, a hint is not', () => {
  const oneWrong = new WordAttempt('cat', LB_CONFIG.medium);
  oneWrong.pop('x');
  popAll(oneWrong, 'cat');
  expect(oneWrong.clean()).toBe(true);

  const twoWrong = new WordAttempt('cat', LB_CONFIG.medium);
  twoWrong.pop('x');
  popAll(twoWrong, 'c');
  twoWrong.pop('z');
  popAll(twoWrong, 'at');
  expect(twoWrong.clean()).toBe(false);

  const hinted = new WordAttempt('cat', LB_CONFIG.medium);
  hinted.useHint();
  popAll(hinted, 'cat');
  expect(hinted.clean()).toBe(false);

  const perfect = new WordAttempt('cat', LB_CONFIG.medium);
  popAll(perfect, 'cat');
  expect(perfect.clean()).toBe(true);
});

test('shouldGlow after two wrong pops on the same letter, reset on the next letter', () => {
  const a = new WordAttempt('cat', LB_CONFIG.medium);
  expect(a.shouldGlow()).toBe(false);
  a.pop('x');
  expect(a.shouldGlow()).toBe(false);
  a.pop('z');
  expect(a.shouldGlow()).toBe(true);
  a.pop('c');
  expect(a.shouldGlow()).toBe(false);
  a.pop('x');
  expect(a.shouldGlow()).toBe(false);
});

test('shouldGlow after a hint, until that letter is popped', () => {
  const a = new WordAttempt('cat', LB_CONFIG.medium);
  a.useHint();
  expect(a.shouldGlow()).toBe(true);
  a.pop('c');
  expect(a.shouldGlow()).toBe(false);
});

test('pop after done is ignored', () => {
  const a = new WordAttempt('cat', LB_CONFIG.medium);
  popAll(a, 'cat');
  expect(a.pop('t')).toBe('ignored');
  expect(a.pop('x')).toBe('ignored');
  a.useHint();
  expect(a.clean()).toBe(true);
  expect(a.shouldGlow()).toBe(false);
});

test('distractorLetters: count within range, none in the word, confusable ones on hard', () => {
  for (const seed of SEEDS) {
    for (const [difficulty, text] of [['medium', 'bread'], ['hard', 'bread'], ['hard', 'elephant'], ['easy', 'cat']] as const) {
      const cfg = LB_CONFIG[difficulty];
      const letters = distractorLetters(text, cfg, mulberry32(seed));
      expect(letters.length).toBeGreaterThanOrEqual(cfg.distractors[0]);
      expect(letters.length).toBeLessThanOrEqual(cfg.distractors[1]);
      expect(new Set(letters).size).toBe(letters.length);
      for (const letter of letters) {
        expect(letter).toMatch(/^[a-z]$/);
        expect(text).not.toContain(letter);
      }
    }
    // The letters of "bread" can be mistaken for p, i and u (d, b, a and e are in the word itself).
    const hard = distractorLetters('bread', LB_CONFIG.hard, mulberry32(seed));
    expect(hard.filter(letter => 'piu'.includes(letter))).toHaveLength(3);
    const medium = distractorLetters('bread', LB_CONFIG.medium, mulberry32(seed));
    expect(medium.filter(letter => 'piu'.includes(letter))).toEqual([]);
  }
});

test('distractorLetters gives both counts of the range over many words', () => {
  const counts = new Set(SEEDS.map(seed => distractorLetters('snake', LB_CONFIG.medium, mulberry32(seed)).length));
  expect([...counts].sort()).toEqual([2, 3]);
});

test('candidatesForLength keeps words inside the range when there are at least 6', () => {
  const words = ['cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'horse', 'elephant'].map(word);
  expect(candidatesForLength(words, LB_CONFIG.easy).map(w => w.en)).toEqual(['cat', 'dog', 'fish', 'bird', 'cow', 'pig']);
});

test('candidatesForLength widens until 6 words', () => {
  const words = ['cat', 'dog', 'fish', 'horse', 'snake', 'tiger', 'rabbit', 'elephant'].map(word);
  // 3-4 letters gives 3 words; 2-5 letters gives 6.
  expect(candidatesForLength(words, LB_CONFIG.easy).map(w => w.en)).toEqual(['cat', 'dog', 'fish', 'horse', 'snake', 'tiger']);
  // Fewer than 6 words in all: every word comes back and the search ends.
  expect(candidatesForLength(words.slice(0, 4), LB_CONFIG.hard)).toHaveLength(4);
  expect(candidatesForLength([], LB_CONFIG.easy)).toEqual([]);
});

test('real word bank: every grade has at least 6 words for every difficulty', () => {
  for (const level of [1, 2, 3, 4] as const) {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(candidatesForLength(wordsUpToLevel(level), LB_CONFIG[difficulty]).length, `level ${level} ${difficulty}`).toBeGreaterThanOrEqual(6);
    }
  }
  expect(candidatesForLength(WORDS, LB_CONFIG.easy).every(w => w.en.length >= 3 && w.en.length <= 4)).toBe(true);
});

test('BalloonRound retries only not-clean words, once, and a clean retry raises cleanCount', () => {
  const round = new BalloonRound(['a', 'b', 'c', 'd', 'e', 'f']);
  const played: string[] = [];
  const play = (clean: boolean): void => {
    played.push(`${round.current()}${round.isRetry() ? '*' : ''}`);
    round.complete(clean);
  };
  play(true);
  play(false);
  play(true);
  play(false);
  play(true);
  play(true);
  expect(round.cleanCount()).toBe(4);
  expect(round.isRetry()).toBe(true);
  play(true);
  play(false);
  expect(played).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'b*', 'd*']);
  expect(round.current()).toBeNull();
  expect(round.cleanCount()).toBe(5);
  expect(round.items()).toEqual([
    { wordId: 'a', firstTry: true }, { wordId: 'b', firstTry: false }, { wordId: 'c', firstTry: true },
    { wordId: 'd', firstTry: false }, { wordId: 'e', firstTry: true }, { wordId: 'f', firstTry: true },
  ]);
  round.complete(true);
  expect(round.cleanCount()).toBe(5);
});

test('BalloonRound with every word clean ends after the last word', () => {
  const round = new BalloonRound(['a', 'b']);
  expect(round.isRetry()).toBe(false);
  round.complete(true);
  round.complete(true);
  expect(round.current()).toBeNull();
  expect(round.isRetry()).toBe(false);
  expect(round.cleanCount()).toBe(2);
});

test('nextSpawn returns the needed letter when it is off screen', () => {
  expect(nextSpawn('p', ['a', 'l'], ['e', 'k'])).toBe('p');
  expect(nextSpawn('p', ['p', 'l'], ['e', 'k'])).toBe('e');
});

test('nextSpawn gives nothing when the queue is empty and nothing is needed', () => {
  expect(nextSpawn(null, ['a'], ['e', 'k'])).toBe('e');
  expect(nextSpawn(null, ['a'], [])).toBeNull();
  expect(nextSpawn('p', ['p'], [])).toBeNull();
});

test('TapGuard: a fast second tap on the same balloon is not counted', () => {
  const guard = new TapGuard(400);
  expect(guard.accept(1, 1000)).toBe(true);
  expect(guard.accept(1, 1050)).toBe(false);
  expect(guard.accept(2, 1050)).toBe(true);
  expect(guard.accept(1, 1399)).toBe(false);
  expect(guard.accept(1, 1400)).toBe(true);
});
