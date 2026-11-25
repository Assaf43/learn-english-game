import type { StorageService } from './storage';
import type { Grade, Profile } from './types';

const PROFILES_KEY = 'profiles';
const CURRENT_KEY = 'currentProfile';
const MAX_NAME_LENGTH = 20;

export class InvalidProfileError extends Error {}

/**
 * A new profile id. `crypto.randomUUID` is missing on plain-http pages that are
 * not localhost (a phone opening the app over the home network) and on older
 * browsers, so there are two fallbacks.
 */
function randomId(): string {
  const source: Partial<Crypto> | undefined = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  if (typeof source?.getRandomValues === 'function') {
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `p-${Date.now().toString(36)}`;
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<Profile>;
  return typeof p.id === 'string' && p.id !== '' && typeof p.name === 'string' && p.name !== ''
    && (p.grade === 3 || p.grade === 4 || p.grade === 5 || p.grade === 6);
}

export class ProfileStore {
  private readonly storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /** All profiles on this device, oldest first. Stored entries that are not profiles are skipped. */
  async list(): Promise<Profile[]> {
    const stored = await this.storage.get<unknown>(PROFILES_KEY);
    return Array.isArray(stored) ? stored.filter(isProfile) : [];
  }

  /** Adds a profile and makes it the current one. The name is trimmed; it must be 1-20 characters. */
  async add(input: { name: string; grade: Grade; avatar: string }): Promise<Profile> {
    const name = input.name.trim();
    const length = [...name].length;
    if (length < 1 || length > MAX_NAME_LENGTH) {
      throw new InvalidProfileError(`Profile name must be 1-${MAX_NAME_LENGTH} characters`);
    }
    const profiles = await this.list();
    const taken = new Set(profiles.map(p => p.id));
    const base = randomId();
    let id = base;
    for (let n = 1; taken.has(id); n++) id = `${base}-${n}`;
    const profile: Profile = { id, name, grade: input.grade, avatar: input.avatar, createdAt: Date.now() };
    await this.storage.set(PROFILES_KEY, [...profiles, profile]);
    await this.select(profile.id);
    return profile;
  }

  /** The last selected profile, or null when none is selected or it no longer exists. */
  async current(): Promise<Profile | null> {
    const id = await this.storage.get<unknown>(CURRENT_KEY);
    if (typeof id !== 'string') return null;
    return (await this.list()).find(p => p.id === id) ?? null;
  }

  async select(id: string): Promise<void> {
    await this.storage.set(CURRENT_KEY, id);
  }
}
