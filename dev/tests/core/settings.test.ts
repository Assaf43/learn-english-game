import { expect, test } from 'vitest';
import { SettingsStore } from '../../src/core/settings';
import { MemoryStorageService } from '../../src/core/storage';

test('no difficulty is remembered before the player chooses one', async () => {
  expect(await new SettingsStore(new MemoryStorageService(), 'p1').lastDifficulty('word-object')).toBeNull();
});

test('the last difficulty is remembered per game and per profile', async () => {
  const storage = new MemoryStorageService();
  const store = new SettingsStore(storage, 'p1');
  await store.setDifficulty('word-object', 'hard');
  await store.setDifficulty('listen-catch', 'easy');
  await store.setDifficulty('word-object', 'medium');

  const again = new SettingsStore(storage, 'p1');
  expect(await again.lastDifficulty('word-object')).toBe('medium');
  expect(await again.lastDifficulty('listen-catch')).toBe('easy');
  expect(await again.lastDifficulty('letter-balloons')).toBeNull();
  expect(await new SettingsStore(storage, 'p2').lastDifficulty('word-object')).toBeNull();
  expect(await storage.get('settings.p1')).toEqual({ difficulty: { 'word-object': 'medium', 'listen-catch': 'easy' } });
});

test('a damaged stored value reads as no choice', async () => {
  const storage = new MemoryStorageService();
  await storage.set('settings.p1', { difficulty: { 'word-object': 'impossible' } });
  const store = new SettingsStore(storage, 'p1');
  expect(await store.lastDifficulty('word-object')).toBeNull();
  await storage.set('settings.p1', 'nonsense');
  expect(await store.lastDifficulty('word-object')).toBeNull();
  await store.setDifficulty('word-object', 'easy');
  expect(await store.lastDifficulty('word-object')).toBe('easy');
});
