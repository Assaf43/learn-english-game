/**
 * All persistence goes through this interface. It is async on purpose:
 * Step 2 swaps in a network implementation.
 */
export interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'eg.';

function parse<T>(raw: string | null | undefined): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Keeps values for the current session only. */
export class MemoryStorageService implements StorageService {
  private readonly values = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    return parse<T>(this.values.get(key));
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function defaultBackend(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Stores JSON in localStorage under the `eg.` prefix. Never throws: when the
 * backend fails for a key (private mode, full storage), that key lives in
 * memory for the rest of the session.
 */
export class LocalStorageService implements StorageService {
  private readonly backend: Storage | null;
  /** Keys the backend failed on. `null` marks a removed key. */
  private readonly fallback = new Map<string, string | null>();

  constructor(backend?: Storage) {
    this.backend = backend ?? defaultBackend();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.fallback.has(key)) return parse<T>(this.fallback.get(key));
    try {
      if (!this.backend) return null;
      return parse<T>(this.backend.getItem(PREFIX + key));
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const raw = JSON.stringify(value);
    try {
      if (!this.backend) throw new Error('no storage backend');
      this.backend.setItem(PREFIX + key, raw);
      this.fallback.delete(key);
    } catch {
      this.fallback.set(key, raw);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (!this.backend) throw new Error('no storage backend');
      this.backend.removeItem(PREFIX + key);
      this.fallback.delete(key);
    } catch {
      this.fallback.set(key, null);
    }
  }
}
