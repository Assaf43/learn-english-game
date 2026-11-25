import { expect, test } from 'vitest';
import { StarStore, starsFromRatio } from '../../src/core/stars';
import { MemoryStorageService } from '../../src/core/storage';

test.each([[10, 10, 3], [9, 10, 3], [8, 10, 2], [6, 10, 2], [5, 10, 1], [0, 10, 1], [6, 6, 3], [5, 6, 2], [4, 6, 2], [3, 6, 1]])(
  '%i of %i gives %i stars', (g, t, s) => expect(starsFromRatio(g, t)).toBe(s));

test('a round with no items still gives 1 star', () => {
  expect(starsFromRatio(0, 0)).toBe(1);
});

test('totals start at zero and add up per game', async () => {
  const store = new StarStore(new MemoryStorageService(), 'p1');
  expect(await store.totals()).toEqual({
    total: 0,
    byGame: { 'letter-balloons': 0, 'listen-catch': 0, 'word-object': 0 },
  });
  await store.add('word-object', 3);
  await store.add('word-object', 1);
  await store.add('listen-catch', 2);
  expect(await store.totals()).toEqual({
    total: 6,
    byGame: { 'letter-balloons': 0, 'listen-catch': 2, 'word-object': 4 },
  });
});

test('stars persist across instances and are kept apart per profile', async () => {
  const storage = new MemoryStorageService();
  await new StarStore(storage, 'p1').add('letter-balloons', 2);
  expect((await new StarStore(storage, 'p1').totals()).total).toBe(2);
  expect((await new StarStore(storage, 'p2').totals()).total).toBe(0);
  expect(await storage.get('stars.p1')).toEqual({ 'letter-balloons': 2, 'listen-catch': 0, 'word-object': 0 });
});

test('stars are never deducted', async () => {
  const store = new StarStore(new MemoryStorageService(), 'p1');
  await store.add('word-object', 3);
  await store.add('word-object', -2);
  await store.add('word-object', Number.NaN);
  expect((await store.totals()).total).toBe(3);
});

test('damaged stored stars read as zero', async () => {
  const storage = new MemoryStorageService();
  await storage.set('stars.p1', { 'word-object': 'many', 'listen-catch': -4, other: 9 });
  const store = new StarStore(storage, 'p1');
  expect(await store.totals()).toEqual({
    total: 0,
    byGame: { 'letter-balloons': 0, 'listen-catch': 0, 'word-object': 0 },
  });
  await store.add('word-object', 2);
  expect((await store.totals()).total).toBe(2);
});
