import type { StorageService } from './storage';
import type { GameId } from './types';

const GAMES: readonly GameId[] = ['letter-balloons', 'listen-catch', 'word-object'];

/** Stars for a finished round. A finished round always gives at least 1 star. */
export function starsFromRatio(good: number, total: number): 1 | 2 | 3 {
  const ratio = total > 0 ? good / total : 0;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

/** One player's collected stars, per game. Stars are only ever added. */
export class StarStore {
  private readonly storage: StorageService;
  private readonly key: string;

  constructor(storage: StorageService, profileId: string) {
    this.storage = storage;
    this.key = `stars.${profileId}`;
  }

  async add(game: GameId, stars: number): Promise<void> {
    if (!(stars > 0)) return;
    const byGame = await this.read();
    byGame[game] += stars;
    await this.storage.set(this.key, byGame);
  }

  async totals(): Promise<{ total: number; byGame: Record<GameId, number> }> {
    const byGame = await this.read();
    const total = GAMES.reduce((sum, game) => sum + byGame[game], 0);
    return { total, byGame };
  }

  /** Stored stars, with missing or damaged values read as zero. */
  private async read(): Promise<Record<GameId, number>> {
    const stored = await this.storage.get<Record<string, unknown>>(this.key);
    const byGame: Record<GameId, number> = { 'letter-balloons': 0, 'listen-catch': 0, 'word-object': 0 };
    if (typeof stored !== 'object' || stored === null) return byGame;
    for (const game of GAMES) {
      const value = stored[game];
      if (typeof value === 'number' && value > 0) byGame[game] = value;
    }
    return byGame;
  }
}
