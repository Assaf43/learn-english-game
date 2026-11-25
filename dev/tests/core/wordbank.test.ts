import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { WORDS, levelForGrade, wordById, wordsUpToLevel } from '../../src/core/wordbank';

const CATEGORIES = ['animals', 'food', 'home', 'tools', 'clothes', 'body', 'school', 'transport'];
const TRAPS = ['silent-e', 'double-letter', 'vowel', 'mirror-letter', 'digraph'];

test('ids are unique, equal en, a-z, 3-8 letters', () => {
  const ids = WORDS.map(w => w.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const w of WORDS) {
    expect(w.id).toBe(w.en);
    expect(w.en).toMatch(/^[a-z]{3,8}$/);
    expect(w.he.trim()).not.toBe('');
  }
});
test('coverage: >=140 words, >=12 per category, >=30 per level, >=15 short level-1 words', () => {
  expect(WORDS.length).toBeGreaterThanOrEqual(140);
  for (const category of CATEGORIES) {
    expect(WORDS.filter(w => w.category === category).length, category).toBeGreaterThanOrEqual(12);
  }
  for (const level of [1, 2, 3, 4]) {
    expect(WORDS.filter(w => w.level === level).length, `level ${level}`).toBeGreaterThanOrEqual(30);
  }
  expect(WORDS.filter(w => w.level === 1 && w.en.length <= 4).length).toBeGreaterThanOrEqual(15);
});
test('category, level and trap hold only allowed values', () => {
  for (const w of WORDS) {
    expect(CATEGORIES, w.id).toContain(w.category);
    expect([1, 2, 3, 4], w.id).toContain(w.level);
    if (w.trap !== undefined) expect(TRAPS, w.id).toContain(w.trap);
  }
});
test('image and audio paths follow the id', () => {
  for (const w of WORDS) {
    expect(w.image).toBe(`img/words/${w.id}.svg`);
    expect(w.audio).toBe(`audio/${w.id}.mp3`);
  }
});
test('every image file exists', () => {
  for (const w of WORDS) expect(existsSync(`public/${w.image}`), w.image).toBe(true);
});
test('confusableWith is symmetric and points at real ids', () => {
  for (const a of WORDS) {
    for (const otherId of a.confusableWith ?? []) {
      expect(otherId, a.id).not.toBe(a.id);
      const b = wordById(otherId);
      expect(b, `${a.id} -> ${otherId}`).toBeDefined();
      expect(b?.confusableWith ?? [], `${otherId} -> ${a.id}`).toContain(a.id);
    }
  }
});
test('levelForGrade maps 3..6 to 1..4', () => {
  expect([3, 4, 5, 6].map(g => levelForGrade(g as 3 | 4 | 5 | 6))).toEqual([1, 2, 3, 4]);
});
test('wordsUpToLevel returns every word at or below the level and no other', () => {
  const upTo2 = wordsUpToLevel(2);
  expect(upTo2.every(w => w.level <= 2)).toBe(true);
  expect(upTo2.length).toBe(WORDS.filter(w => w.level <= 2).length);
  expect(wordsUpToLevel(4).length).toBe(WORDS.length);
});
test('wordById finds a word and returns undefined for an unknown id', () => {
  expect(wordById(WORDS[0].id)).toBe(WORDS[0]);
  expect(wordById('no-such-word')).toBeUndefined();
});
