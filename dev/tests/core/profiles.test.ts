import { expect, test, vi } from 'vitest';
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

test('a profile gets an id where crypto.randomUUID is missing (a phone on plain http)', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  try {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) & 255;
        return bytes;
      },
    });
    const a = await store.add({ name: 'יובל', grade: 5, avatar: '1' });
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // The same random bytes again: the new profile still gets an id of its own.
    const b = await store.add({ name: 'אלון', grade: 4, avatar: '2' });
    expect(b.id).not.toBe(a.id);

    vi.stubGlobal('crypto', undefined);
    const c = await store.add({ name: 'נועה', grade: 3, avatar: '3' });
    const d = await store.add({ name: 'דנה', grade: 6, avatar: '4' });
    expect(c.id).not.toBe('');
    expect(new Set([a.id, b.id, c.id, d.id]).size).toBe(4);
    expect((await store.current())?.id).toBe(d.id);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('stored entries that are not profiles are skipped', async () => {
  const storage = new MemoryStorageService();
  const good = { id: 'ok', name: 'יובל', grade: 5, avatar: '2', createdAt: 1 };
  await storage.set('profiles', [null, 5, 'text', { id: 'no-name', grade: 4 }, good, { id: 'bad-grade', name: 'x', grade: 9, avatar: '1', createdAt: 2 }]);
  await storage.set('currentProfile', 'ok');
  const store = new ProfileStore(storage);
  expect(await store.list()).toEqual([good]);
  expect(await store.current()).toEqual(good);
  await storage.set('currentProfile', 'bad-grade');
  expect(await store.current()).toBeNull();
});
