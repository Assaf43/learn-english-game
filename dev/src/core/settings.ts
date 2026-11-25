import type { StorageService } from './storage';
import type { Difficulty, GameId } from './types';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

interface StoredSettings {
  difficulty: Partial<Record<GameId, Difficulty>>;
}

/** One player's choices that should be remembered between rounds. */
export class SettingsStore {
  private readonly storage: StorageService;
  private readonly key: string;

  constructor(storage: StorageService, profileId: string) {
    this.storage = storage;
    this.key = `settings.${profileId}`;
  }

  /** The difficulty last played in this game, or null when the player has not chosen one yet. */
  async lastDifficulty(game: GameId): Promise<Difficulty | null> {
    const value = (await this.read()).difficulty[game];
    return value !== undefined && DIFFICULTIES.includes(value) ? value : null;
  }

  async setDifficulty(game: GameId, difficulty: Difficulty): Promise<void> {
    const settings = await this.read();
    settings.difficulty[game] = difficulty;
    await this.storage.set(this.key, settings);
  }

  /** Stored settings, with missing or damaged data read as empty. */
  private async read(): Promise<StoredSettings> {
    const stored = await this.storage.get<Partial<StoredSettings>>(this.key);
    const difficulty: Partial<Record<GameId, Difficulty>> = {};
    if (typeof stored === 'object' && stored !== null && typeof stored.difficulty === 'object' && stored.difficulty !== null) {
      for (const [game, value] of Object.entries(stored.difficulty)) {
        if (DIFFICULTIES.includes(value)) difficulty[game as GameId] = value;
      }
    }
    return { difficulty };
  }
}
