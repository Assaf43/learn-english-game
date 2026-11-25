import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { mulberry32 } from '../../src/core/rng';
import {
  COLOURS, NOUNS, ROUND_SIZE, SIZES, allPhrases, buildScene, buildScenes, phraseId, phraseText, type Thing,
} from '../../src/games/listen-catch/scene';

const SEEDS = Array.from({ length: 200 }, (_, i) => i);
const ATTRIBUTES = ['noun', 'colour', 'size'] as const;

/** The attributes in which two things differ. */
function differences(a: Thing, b: Thing): string[] {
  return ATTRIBUTES.filter(attribute => a[attribute] !== b[attribute]);
}

test('the nouns, colours and sizes are the ones in the plan', () => {
  expect(NOUNS).toEqual(['ball', 'star', 'book', 'car', 'hat', 'cup', 'fish', 'apple', 'heart', 'key', 'bell', 'shoe']);
  expect(COLOURS).toEqual({ red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#fdd835', black: '#212121', pink: '#ec407a' });
  expect(SIZES).toEqual({ big: 1, small: 0.55 });
  expect(ROUND_SIZE).toBe(10);
});

test('phrase ids and texts', () => {
  expect(phraseId({ noun: 'ball', colour: 'red' })).toBe('p2-red-ball');
  expect(phraseText({ noun: 'ball', colour: 'red' })).toBe('a red ball');
  expect(phraseId({ noun: 'ball', colour: 'red', size: 'small' })).toBe('p3-small-red-ball');
  expect(phraseText({ noun: 'ball', colour: 'red', size: 'small' })).toBe('Touch the small red ball');
});

test('allPhrases has 216 unique ids', () => {
  const phrases = allPhrases();
  expect(phrases).toHaveLength(216);
  expect(new Set(phrases.map(p => p.id)).size).toBe(216);
  expect(new Set(phrases.map(p => p.text)).size).toBe(216);
  expect(phrases.filter(p => p.id.startsWith('p2-'))).toHaveLength(72);
  expect(phrases.filter(p => p.id.startsWith('p3-'))).toHaveLength(144);
  expect(phrases).toContainEqual({ id: 'p3-big-pink-shoe', text: 'Touch the big pink shoe' });
});

test.each([['medium', 4], ['hard', 6]] as const)(
  '%s scene: %i distinct options incl. target, each distractor differs in exactly one attribute',
  (difficulty, count) => {
    for (const seed of SEEDS) {
      const { target, options } = buildScene(difficulty, mulberry32(seed));
      expect(options).toHaveLength(count);
      expect(new Set(options.map(phraseId)).size).toBe(count);
      expect(options.filter(o => phraseId(o) === phraseId(target))).toHaveLength(1);
      for (const option of options) {
        if (phraseId(option) === phraseId(target)) continue;
        expect(differences(option, target), `seed ${seed}`).toHaveLength(1);
      }
    }
  },
);

test('medium scenes have no size; hard scenes give every thing a size', () => {
  for (const seed of SEEDS) {
    expect(buildScene('medium', mulberry32(seed)).options.every(o => o.size === undefined)).toBe(true);
    expect(buildScene('hard', mulberry32(seed)).options.every(o => o.size === 'big' || o.size === 'small')).toBe(true);
  }
});

test('hard scene varies noun, colour and size across its distractors', () => {
  for (const seed of SEEDS) {
    const { target, options } = buildScene('hard', mulberry32(seed));
    const varied = new Set(options.flatMap(o => differences(o, target)));
    expect([...varied].sort(), `seed ${seed}`).toEqual(['colour', 'noun', 'size']);
  }
});

test('medium scene varies noun and colour across its distractors', () => {
  for (const seed of SEEDS) {
    const { target, options } = buildScene('medium', mulberry32(seed));
    const varied = new Set(options.flatMap(o => differences(o, target)));
    expect([...varied].sort(), `seed ${seed}`).toEqual(['colour', 'noun']);
  }
});

test('targets and their place among the options change from scene to scene', () => {
  const scenes = SEEDS.map(seed => buildScene('hard', mulberry32(seed)));
  expect(new Set(scenes.map(s => phraseId(s.target))).size).toBeGreaterThan(60);
  expect(new Set(scenes.map(s => s.options.findIndex(o => phraseId(o) === phraseId(s.target)))).size).toBe(6);
});

test.each(['medium', 'hard'] as const)('a %s round has 10 scenes with different targets', difficulty => {
  for (const seed of SEEDS.slice(0, 50)) {
    const scenes = buildScenes(difficulty, ROUND_SIZE, mulberry32(seed));
    expect(scenes).toHaveLength(10);
    expect(new Set(scenes.map(s => phraseId(s.target))).size).toBe(10);
  }
});

test('every noun has a single-path shape that takes its colour from the page', () => {
  for (const noun of NOUNS) {
    const file = `public/img/shapes/${noun}.svg`;
    expect(existsSync(file), file).toBe(true);
    const svg = readFileSync(file, 'utf8');
    expect(svg.match(/<path\b/g), file).toHaveLength(1);
    expect(svg, file).toContain('fill="currentColor"');
    expect(svg, file).not.toMatch(/<(script|image|circle|rect|polygon|g)\b/);
  }
});
