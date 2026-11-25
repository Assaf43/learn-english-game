import { expect, test } from 'vitest';
import { ProgressStore, nextProgress, pickRoundWords } from '../../src/core/progress';
import { mulberry32 } from '../../src/core/rng';
import { MemoryStorageService } from '../../src/core/storage';
import type { Level, Word, WordProgress } from '../../src/core/types';

function word(id: string, level: Level = 1): Word {
  return { id, en: id, he: id, image: `img/words/${id}.svg`, audio: `audio/${id}.mp3`, category: 'animals', level };
}
function words(prefix: string, n: number, level: Level = 1): Word[] {
  return Array.from({ length: n }, (_, i) => word(`${prefix}${i}`, level));
}
const ids = (ws: Word[]) => ws.map(w => w.id);

test('nextProgress', () => {
  expect(nextProgress(undefined, true, 4)).toEqual({ box: 2, lastSeenRound: 4 });
  expect(nextProgress(undefined, false, 4)).toEqual({ box: 1, lastSeenRound: 4 });
  expect(nextProgress({ box: 1, lastSeenRound: 1 }, true, 4).box).toBe(2);
  expect(nextProgress({ box: 2, lastSeenRound: 1 }, true, 4).box).toBe(3);
  expect(nextProgress({ box: 3, lastSeenRound: 1 }, true, 4).box).toBe(3);
  expect(nextProgress({ box: 3, lastSeenRound: 1 }, false, 4).box).toBe(1);
  expect(nextProgress({ box: 3, lastSeenRound: 1 }, false, 4).lastSeenRound).toBe(4);
});

test('10-word round takes 3 due words first, box 1 before box 2', () => {
  const candidates = words('w', 20);
  const progress: Record<string, WordProgress> = {
    w0: { box: 1, lastSeenRound: 9 },
    w1: { box: 1, lastSeenRound: 8 },
    w2: { box: 2, lastSeenRound: 1 },
    w3: { box: 2, lastSeenRound: 2 },
  };
  for (let seed = 0; seed < 20; seed++) {
    const picked = ids(pickRoundWords({ candidates, level: 1, count: 10, progress, roundNumber: 10, rng: mulberry32(seed) }));
    expect(picked).toHaveLength(10);
    expect(picked).toEqual(expect.arrayContaining(['w0', 'w1', 'w2']));
    expect(picked).not.toContain('w3');
  }
});

test('box 2 seen 2 rounds ago is not due; seen 3 rounds ago is', () => {
  const candidates = [...words('new', 10, 1), word('old', 2)];
  const pick = (lastSeenRound: number) =>
    ids(pickRoundWords({ candidates, level: 1, count: 5, progress: { old: { box: 2, lastSeenRound } }, roundNumber: 10, rng: mulberry32(3) }));
  expect(pick(8)).not.toContain('old');
  expect(pick(7)).toContain('old');
});

test('box 3 is due only after 8 rounds', () => {
  const candidates = [...words('new', 10, 1), word('old', 2)];
  const pick = (lastSeenRound: number) =>
    ids(pickRoundWords({ candidates, level: 1, count: 5, progress: { old: { box: 3, lastSeenRound } }, roundNumber: 10, rng: mulberry32(3) }));
  expect(pick(3)).not.toContain('old');
  expect(pick(2)).toContain('old');
});

test('no duplicates and exact count when enough candidates', () => {
  const candidates = [...words('a', 12, 1), ...words('b', 12, 2)];
  const progress: Record<string, WordProgress> = {
    a0: { box: 1, lastSeenRound: 0 },
    b0: { box: 1, lastSeenRound: 0 },
    a1: { box: 3, lastSeenRound: 0 },
  };
  for (let seed = 0; seed < 50; seed++) {
    const picked = ids(pickRoundWords({ candidates, level: 2, count: 10, progress, roundNumber: 5, rng: mulberry32(seed) }));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
  }
});

test('with 4 candidates and count 10 returns the 4', () => {
  const picked = ids(pickRoundWords({ candidates: words('w', 4), level: 1, count: 10, progress: {}, roundNumber: 0, rng: mulberry32(1) }));
  expect(picked.sort()).toEqual(['w0', 'w1', 'w2', 'w3']);
});

test('fills from other levels when the level has too few words', () => {
  const candidates = [...words('low', 10, 1), ...words('top', 3, 2)];
  const picked = ids(pickRoundWords({ candidates, level: 2, count: 6, progress: {}, roundNumber: 0, rng: mulberry32(1) }));
  expect(picked).toHaveLength(6);
  expect(picked).toEqual(expect.arrayContaining(['top0', 'top1', 'top2']));
});

test('words of the level that were never seen come before seen ones', () => {
  const candidates = words('w', 10);
  const progress: Record<string, WordProgress> = {};
  for (let i = 0; i < 5; i++) progress[`w${i}`] = { box: 3, lastSeenRound: 10 };
  const picked = ids(pickRoundWords({ candidates, level: 1, count: 5, progress, roundNumber: 10, rng: mulberry32(2) }));
  expect(picked.sort()).toEqual(['w5', 'w6', 'w7', 'w8', 'w9']);
});

test('a candidate listed twice is returned once', () => {
  const candidates = [...words('w', 3), ...words('w', 3)];
  const picked = ids(pickRoundWords({ candidates, level: 1, count: 10, progress: {}, roundNumber: 0, rng: mulberry32(1) }));
  expect(picked.sort()).toEqual(['w0', 'w1', 'w2']);
});

test('different seeds give different rounds', () => {
  const candidates = words('w', 30);
  const pick = (seed: number) =>
    ids(pickRoundWords({ candidates, level: 1, count: 10, progress: {}, roundNumber: 0, rng: mulberry32(seed) })).join();
  expect(new Set([pick(1), pick(2), pick(3)]).size).toBeGreaterThan(1);
});

test('ProgressStore persists across instances and counts known words', async () => {
  const storage = new MemoryStorageService();
  const store = new ProgressStore(storage, 'p1');
  await store.load();
  expect(store.roundNumber()).toBe(0);
  expect(store.knownCount()).toBe(0);
  store.record('cat', true);
  store.record('dog', false);
  await store.finishRound();

  const again = new ProgressStore(storage, 'p1');
  await again.load();
  expect(again.roundNumber()).toBe(1);
  expect(again.all()).toEqual({ cat: { box: 2, lastSeenRound: 0 }, dog: { box: 1, lastSeenRound: 0 } });
  expect(again.knownCount()).toBe(1);
  expect(await storage.get('progress.p1')).toEqual({ round: 1, words: again.all() });
});

test('ProgressStore keeps profiles apart', async () => {
  const storage = new MemoryStorageService();
  const a = new ProgressStore(storage, 'a');
  await a.load();
  a.record('cat', true);
  await a.finishRound();
  const b = new ProgressStore(storage, 'b');
  await b.load();
  expect(b.all()).toEqual({});
  expect(b.roundNumber()).toBe(0);
});

test('ProgressStore reads corrupt stored data as empty', async () => {
  const storage = new MemoryStorageService();
  await storage.set('progress.p1', { round: 'x', words: [1, 2] });
  const store = new ProgressStore(storage, 'p1');
  await store.load();
  expect(store.roundNumber()).toBe(0);
  expect(store.all()).toEqual({});
});
