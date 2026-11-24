import type { StorageService } from './storage';
import type { Grade, Profile } from './types';

const PROFILES_KEY = 'profiles';
const CURRENT_KEY = 'currentProfile';
const MAX_NAME_LENGTH = 20;

export class InvalidProfileError extends Error {}

export class ProfileStore {
  private readonly storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /** All profiles on this device, oldest first. */
  async list(): Promise<Profile[]> {
    const stored = await this.storage.get<unknown>(PROFILES_KEY);
    return Array.isArray(stored) ? (stored as Profile[]) : [];
  }

  /** Adds a profile and makes it the current one. The name is trimmed; it must be 1-20 characters. */
  async add(input: { name: string; grade: Grade; avatar: string }): Promise<Profile> {
    const name = input.name.trim();
    const length = [...name].length;
    if (length < 1 || length > MAX_NAME_LENGTH) {
      throw new InvalidProfileError(`Profile name must be 1-${MAX_NAME_LENGTH} characters`);
    }
    const profile: Profile = {
      id: crypto.randomUUID(),
      name,
      grade: input.grade,
      avatar: input.avatar,
      createdAt: Date.now(),
    };
    const profiles = await this.list();
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
