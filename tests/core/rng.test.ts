import { expect, test } from 'vitest';
import { mulberry32, sample, shuffle } from '../../src/core/rng';

test('same seed gives same sequence', () => {
  const a = mulberry32(7), b = mulberry32(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test('values are in [0, 1) and differ between seeds', () => {
  const a = mulberry32(1), b = mulberry32(2);
  const xs = Array.from({ length: 50 }, () => a());
  for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  expect(xs.slice(0, 3)).not.toEqual([b(), b(), b()]);
});
test('shuffle keeps all items and does not mutate', () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, mulberry32(1));
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(src).toEqual([1, 2, 3, 4, 5]);
});
test('sample never repeats and caps at length', () => {
  expect(new Set(sample([1, 2, 3], 2, mulberry32(1))).size).toBe(2);
  expect(sample([1, 2, 3], 9, mulberry32(1))).toHaveLength(3);
});
