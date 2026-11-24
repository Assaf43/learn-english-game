import { expect, test } from 'vitest';
import { InvalidProfileError, ProfileStore } from '../../src/core/profiles';
import { MemoryStorageService } from '../../src/core/storage';

test('add trims the name and selects the new profile', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  const p = await store.add({ name: '  יובל ', grade: 5, avatar: 'a1' });
  expect(p.name).toBe('יובל');
  expect((await store.current())?.id).toBe(p.id);
});
test.each(['', '   ', 'x'.repeat(21)])('rejects name %j', async (name) => {
  const store = new ProfileStore(new MemoryStorageService());
  await expect(store.add({ name, grade: 4, avatar: 'a1' })).rejects.toBeInstanceOf(InvalidProfileError);
  expect(await store.list()).toEqual([]);
});
test('accepts a 20-character name and a 1-character name', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  expect((await store.add({ name: 'א'.repeat(20), grade: 3, avatar: 'a1' })).name).toHaveLength(20);
  expect((await store.add({ name: ' ב ', grade: 3, avatar: 'a1' })).name).toBe('ב');
});
test('two profiles are listed oldest first and select switches current', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  const a = await store.add({ name: 'יובל', grade: 5, avatar: 'a1' });
  const b = await store.add({ name: 'אלון', grade: 4, avatar: 'a2' });
  expect(a.id).not.toBe(b.id);
  expect((await store.list()).map(p => p.id)).toEqual([a.id, b.id]);
  expect((await store.current())?.id).toBe(b.id);
  await store.select(a.id);
  expect((await store.current())?.id).toBe(a.id);
});
test('current is null when the stored id no longer exists', async () => {
  const storage = new MemoryStorageService();
  await storage.set('currentProfile', 'ghost');
  expect(await new ProfileStore(storage).current()).toBeNull();
});
test('profiles persist across store instances', async () => {
  const storage = new MemoryStorageService();
  const p = await new ProfileStore(storage).add({ name: 'יובל', grade: 6, avatar: 'a3' });
  const again = new ProfileStore(storage);
  expect(await again.list()).toEqual([p]);
  expect(await again.current()).toEqual(p);
});
test('stored profiles that are not a list read as no profiles', async () => {
  const storage = new MemoryStorageService();
  await storage.set('profiles', { broken: true });
  const store = new ProfileStore(storage);
  expect(await store.list()).toEqual([]);
  const p = await store.add({ name: 'יובל', grade: 5, avatar: 'a1' });
  expect(await store.list()).toEqual([p]);
});
