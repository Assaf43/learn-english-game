import { expect, test } from 'vitest';
import { mulberry32 } from '../../src/core/rng';
import type { Category, Difficulty, Word } from '../../src/core/types';
import { WORDS, wordsUpToLevel } from '../../src/core/wordbank';
import { ItemTaps, ROUND_SIZE, WO_CONFIG, buildOptions, reverseConfig } from '../../src/games/word-object/logic';

function word(id: string, category: Category, confusableWith?: string[]): Word {
  return { id, en: id, he: id, image: `img/words/${id}.svg`, audio: `audio/${id}.mp3`, category, level: 1, confusableWith };
}
function words(prefix: string, n: number, category: Category): Word[] {
  return Array.from({ length: n }, (_, i) => word(`${prefix}${i}`, category));
}
const ids = (ws: Word[]) => ws.map(w => w.id);
const SEEDS = Array.from({ length: 100 }, (_, i) => i);

const target = word('cat', 'animals');
const animals = words('animal', 12, 'animals');
const others = [...words('food', 6, 'food'), ...words('tool', 6, 'tools')];
const pool = [target, ...animals, ...others];

test('the settings for each difficulty are the ones in the plan', () => {
  expect(WO_CONFIG).toEqual({
    easy: { pictures: 4, sameCategory: 0, preferSameFirstLetter: false, drift: false, audio: 'auto' },
    medium: { pictures: 6, sameCategory: 3, preferSameFirstLetter: false, drift: false, audio: 'tap' },
    hard: { pictures: 9, sameCategory: 6, preferSameFirstLetter: true, drift: true, audio: 'after' },
  });
  expect(ROUND_SIZE).toBe(10);
});

test('easy: 4 options, target once, no same-category distractor', () => {
  for (const seed of SEEDS) {
    const options = buildOptions(target, pool, WO_CONFIG.easy, mulberry32(seed));
    expect(options).toHaveLength(4);
    expect(options.filter(o => o.id === 'cat')).toHaveLength(1);
    expect(options.filter(o => o.category === 'animals')).toHaveLength(1);
  }
});

test('medium: 6 options with 3 distractors from the target category', () => {
  for (const seed of SEEDS) {
    const options = buildOptions(target, pool, WO_CONFIG.medium, mulberry32(seed));
    expect(options).toHaveLength(6);
    expect(new Set(ids(options)).size).toBe(6);
    expect(options.filter(o => o.category === 'animals' && o.id !== 'cat')).toHaveLength(3);
  }
});

test('hard: 9 options, same-first-letter distractors preferred', () => {
  const sameLetter = [word('cow', 'animals'), word('crab', 'animals'), word('camel', 'animals')];
  const hardPool = [target, ...animals, ...sameLetter, ...others];
  for (const seed of SEEDS) {
    const options = buildOptions(target, hardPool, WO_CONFIG.hard, mulberry32(seed));
    expect(options).toHaveLength(9);
    expect(options.filter(o => o.category === 'animals' && o.id !== 'cat')).toHaveLength(6);
    expect(ids(options)).toEqual(expect.arrayContaining(['cow', 'crab', 'camel']));
  }
});

test('the target is not always in the same place', () => {
  const places = new Set(SEEDS.map(seed => ids(buildOptions(target, pool, WO_CONFIG.easy, mulberry32(seed))).indexOf('cat')));
  expect(places.size).toBe(4);
});

test('never includes a confusableWith word', () => {
  const mouse = word('mouse', 'animals', ['rat']);
  const rat = word('rat', 'animals', ['mouse']);
  const hamster = word('hamster', 'animals');
  const listsMouse = word('gerbil', 'animals', ['mouse']);
  const small = [mouse, rat, hamster, listsMouse, ...words('food', 2, 'food')];
  for (const seed of SEEDS) {
    const options = ids(buildOptions(mouse, small, WO_CONFIG.hard, mulberry32(seed)));
    expect(options).not.toContain('rat');
    expect(options).not.toContain('gerbil');
    expect(options.sort()).toEqual(['food0', 'food1', 'hamster', 'mouse']);
  }
});

test('small pool: returns what exists, no duplicates, target present', () => {
  const small = [target, word('dog', 'animals'), word('egg', 'food')];
  const options = ids(buildOptions(target, small, WO_CONFIG.hard, mulberry32(1)));
  expect(options.sort()).toEqual(['cat', 'dog', 'egg']);
});

test('the target is included once even when the pool does not list it or lists it twice', () => {
  expect(ids(buildOptions(target, others, WO_CONFIG.easy, mulberry32(1))).filter(id => id === 'cat')).toHaveLength(1);
  const doubled = [target, target, ...others, ...others];
  const options = ids(buildOptions(target, doubled, WO_CONFIG.hard, mulberry32(1)));
  expect(new Set(options).size).toBe(options.length);
  expect(options.filter(id => id === 'cat')).toHaveLength(1);
});

test('category too small: fills from other categories up to the requested count', () => {
  const fewAnimals = [target, word('dog', 'animals'), ...others];
  for (const seed of SEEDS) {
    const options = buildOptions(target, fewAnimals, WO_CONFIG.hard, mulberry32(seed));
    expect(options).toHaveLength(9);
    expect(new Set(ids(options)).size).toBe(9);
    expect(ids(options)).toContain('dog');
  }
});

test('other categories too small: fills from the target category', () => {
  const fewOthers = [target, ...animals, word('egg', 'food')];
  for (const seed of SEEDS) {
    const options = buildOptions(target, fewOthers, WO_CONFIG.easy, mulberry32(seed));
    expect(options).toHaveLength(4);
    expect(ids(options)).toContain('egg');
  }
});

test('picture-to-word mode offers 3 words on easy and 4 on medium and hard', () => {
  expect(reverseConfig('easy')).toEqual({ pictures: 3, sameCategory: 0, preferSameFirstLetter: false });
  expect(reverseConfig('medium')).toEqual({ pictures: 4, sameCategory: 3, preferSameFirstLetter: false });
  expect(reverseConfig('hard')).toEqual({ pictures: 4, sameCategory: 6, preferSameFirstLetter: true });
  expect(buildOptions(target, pool, reverseConfig('hard'), mulberry32(1))).toHaveLength(4);
});

test('real word bank: every word gets a full, valid set of options at every difficulty', () => {
  const levelOne = wordsUpToLevel(1);
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
  for (const [poolName, bank] of [['level 1', levelOne], ['all', WORDS]] as const) {
    for (const difficulty of difficulties) {
      for (const [i, w] of bank.entries()) {
        const options = buildOptions(w, bank, WO_CONFIG[difficulty], mulberry32(i));
        const label = `${poolName} ${difficulty} ${w.id}`;
        expect(options, label).toHaveLength(WO_CONFIG[difficulty].pictures);
        expect(new Set(ids(options)).size, label).toBe(options.length);
        expect(options.filter(o => o.id === w.id), label).toHaveLength(1);
        for (const o of options) {
          expect(w.confusableWith ?? [], label).not.toContain(o.id);
          expect(o.confusableWith ?? [], label).not.toContain(w.id);
        }
      }
    }
  }
});

test('ItemTaps: a double tap on the right answer counts once', () => {
  const taps = new ItemTaps('cat', ['cat', 'dog', 'egg']);
  expect(taps.tap('cat')).toBe('correct');
  expect(taps.tap('cat')).toBe('ignored');
  expect(taps.tap('dog')).toBe('ignored');
  expect(taps.done()).toBe(true);
});

test('ItemTaps: a double tap on the same wrong answer counts once', () => {
  const taps = new ItemTaps('cat', ['cat', 'dog', 'egg']);
  expect(taps.tap('dog')).toBe('wrong');
  expect(taps.tap('dog')).toBe('ignored');
  expect(taps.tap('egg')).toBe('wrong');
  expect(taps.done()).toBe(false);
  expect(taps.tap('cat')).toBe('correct');
});

test('ItemTaps: a tap on something that is not an option is ignored', () => {
  const taps = new ItemTaps('cat', ['cat', 'dog']);
  expect(taps.tap('horse')).toBe('ignored');
  expect(taps.done()).toBe(false);
});
