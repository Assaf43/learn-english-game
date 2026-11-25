import { expect, test } from 'vitest';
import type { AppContext, Screen } from '../../src/app/context';
import { createRouter, defaultDifficulty, type Route } from '../../src/app/router';
import { SilentAudioPlayer } from '../../src/core/audio';
import { ProfileStore } from '../../src/core/profiles';
import { ProgressStore } from '../../src/core/progress';
import { mulberry32 } from '../../src/core/rng';
import { StarStore } from '../../src/core/stars';
import { MemoryStorageService } from '../../src/core/storage';
import type { RoundResult } from '../../src/core/types';
import { finishRound } from '../../src/screens/summary';

function fakeRoot(log: string[] = []): HTMLElement {
  return { replaceChildren: () => { log.push('clear'); } } as unknown as HTMLElement;
}

function context(navigate: (route: Route) => void = () => {}): AppContext {
  const storage = new MemoryStorageService();
  return { storage, profiles: new ProfileStore(storage), audio: new SilentAudioPlayer(), rng: mulberry32(1), navigate };
}

function spyScreen(name: string, log: string[]): Screen {
  return { mount: () => { log.push(`mount ${name}`); }, unmount: () => { log.push(`unmount ${name}`); } };
}

test('navigate unmounts the previous screen before mounting the next', () => {
  const log: string[] = [];
  const router = createRouter(fakeRoot(), route => spyScreen(route.name === 'who' ? 'A' : 'B', log), context());
  router.navigate({ name: 'who' });
  router.navigate({ name: 'home' });
  expect(log).toEqual(['mount A', 'unmount A', 'mount B']);
});

test('the root is emptied between screens', () => {
  const log: string[] = [];
  const router = createRouter(fakeRoot(log), route => spyScreen(route.name, log), context());
  router.navigate({ name: 'who' });
  router.navigate({ name: 'home' });
  expect(log).toEqual(['clear', 'mount who', 'unmount who', 'clear', 'mount home']);
});

test('the screen factory receives the route and the context', () => {
  const ctx = context();
  const seen: unknown[] = [];
  const router = createRouter(fakeRoot(), (route, c) => { seen.push(route, c); return spyScreen('x', []); }, ctx);
  router.navigate({ name: 'game', game: 'word-object' });
  expect(seen).toEqual([{ name: 'game', game: 'word-object' }, ctx]);
});

test('a screen whose unmount throws does not block navigation', () => {
  const log: string[] = [];
  const broken: Screen = { mount: () => {}, unmount: () => { throw new Error('boom'); } };
  const router = createRouter(fakeRoot(), route => (route.name === 'who' ? broken : spyScreen('B', log)), context());
  router.navigate({ name: 'who' });
  router.navigate({ name: 'home' });
  expect(log).toEqual(['mount B']);
});

test('defaultDifficulty', () => {
  expect([3, 4, 5, 6].map(g => defaultDifficulty(g as 3 | 4 | 5 | 6))).toEqual(['easy', 'easy', 'medium', 'medium']);
});

test('finishRound saves progress, adds stars, navigates to summary', async () => {
  const visited: Route[] = [];
  const ctx = context(route => { visited.push(route); });

  const progress = new ProgressStore(ctx.storage, 'p1');
  await progress.load();
  progress.record('cat', true);
  progress.record('dog', false);
  const result: RoundResult = {
    game: 'word-object',
    difficulty: 'easy',
    items: [{ wordId: 'cat', firstTry: true }, { wordId: 'dog', firstTry: false }],
    stars: 2,
  };

  const done = finishRound(ctx, 'p1', result, progress);
  expect(visited).toEqual([]);
  await done;

  expect(await ctx.storage.get('progress.p1')).toEqual({
    round: 1,
    words: { cat: { box: 2, lastSeenRound: 0 }, dog: { box: 1, lastSeenRound: 0 } },
  });
  expect((await new StarStore(ctx.storage, 'p1').totals()).byGame['word-object']).toBe(2);
  expect(visited).toEqual([{ name: 'summary', result }]);
});

test('finishRound has saved everything by the time it navigates', async () => {
  const ctx = context();
  const seenAtNavigate: unknown[] = [];
  const pending: Promise<void>[] = [];
  ctx.navigate = () => {
    pending.push(
      Promise.all([ctx.storage.get('progress.p1'), ctx.storage.get('stars.p1')]).then(values => { seenAtNavigate.push(...values); }),
    );
  };
  const progress = new ProgressStore(ctx.storage, 'p1');
  await progress.load();
  progress.record('cat', true);
  await finishRound(ctx, 'p1', { game: 'listen-catch', difficulty: 'hard', items: [{ wordId: 'cat', firstTry: true }], stars: 3 }, progress);
  await Promise.all(pending);
  expect(seenAtNavigate).toEqual([
    { round: 1, words: { cat: { box: 2, lastSeenRound: 0 } } },
    { 'letter-balloons': 0, 'listen-catch': 3, 'word-object': 0 },
  ]);
});
