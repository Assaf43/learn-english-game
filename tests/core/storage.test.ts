import { expect, test } from 'vitest';
import { LocalStorageService, MemoryStorageService } from '../../src/core/storage';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  };
}

function throwingStorage(): Storage {
  const fail = (): never => { throw new Error('storage unavailable'); };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

/** Reads work, writes throw: a full storage (quota exceeded). */
function fullStorage(): Storage {
  const base = fakeStorage();
  return { ...base, setItem: () => { throw new Error('QuotaExceededError'); } };
}

test('round-trips JSON under the eg. prefix', async () => {
  const fake = fakeStorage();
  const s = new LocalStorageService(fake);
  await s.set('profiles', [{ id: 'a' }]);
  expect(fake.getItem('eg.profiles')).toBe('[{"id":"a"}]');
  expect(await s.get('profiles')).toEqual([{ id: 'a' }]);
});
test('corrupt JSON reads as null', async () => {
  const fake = fakeStorage(); fake.setItem('eg.x', '{oops');
  expect(await new LocalStorageService(fake).get('x')).toBeNull();
});
test('when the backend throws, values are kept in memory', async () => {
  const s = new LocalStorageService(throwingStorage());
  await s.set('k', 1);
  expect(await s.get('k')).toBe(1);
});
test('when the backend throws, remove still deletes and missing keys read as null', async () => {
  const s = new LocalStorageService(throwingStorage());
  expect(await s.get('none')).toBeNull();
  await s.set('k', 1); await s.remove('k');
  expect(await s.get('k')).toBeNull();
});
test('when storage is full, the new value wins over the old stored one', async () => {
  const fake = fullStorage();
  const s = new LocalStorageService(fake);
  await s.set('k', 'new');
  expect(await s.get('k')).toBe('new');
});
test('LocalStorageService: missing key reads as null; remove deletes', async () => {
  const fake = fakeStorage();
  const s = new LocalStorageService(fake);
  expect(await s.get('none')).toBeNull();
  await s.set('k', 1); await s.remove('k');
  expect(await s.get('k')).toBeNull();
  expect(fake.getItem('eg.k')).toBeNull();
});
test('missing key reads as null; remove deletes', async () => {
  const s = new MemoryStorageService();
  expect(await s.get('none')).toBeNull();
  await s.set('k', 1); await s.remove('k');
  expect(await s.get('k')).toBeNull();
});
test('MemoryStorageService returns copies, not the stored object', async () => {
  const s = new MemoryStorageService();
  const value = { n: 1 };
  await s.set('k', value);
  value.n = 2;
  expect(await s.get('k')).toEqual({ n: 1 });
});
