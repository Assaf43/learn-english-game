import { shuffle, type Rng } from './rng';
import type { StorageService } from './storage';
import type { Level, Word, WordProgress } from './types';

/** Share of a round kept for words that are due for review. */
const REVIEW_SHARE = 0.3;
/** Rounds to wait before a word in box 2 or box 3 comes back. Box 1 is always due. */
const ROUNDS_BEFORE_REVIEW = { 2: 3, 3: 8 } as const;

/**
 * The next box for a word after it was answered in round `round`.
 * Right on the first try moves up one box (a new word starts at box 2, the top is 3);
 * anything else sends the word back to box 1.
 */
export function nextProgress(prev: WordProgress | undefined, firstTry: boolean, round: number): WordProgress {
  if (!firstTry) return { box: 1, lastSeenRound: round };
  const box = prev ? (Math.min(3, prev.box + 1) as 1 | 2 | 3) : 2;
  return { box, lastSeenRound: round };
}

function isDue(p: WordProgress, roundNumber: number): boolean {
  if (p.box === 1) return true;
  return roundNumber - p.lastSeenRound >= ROUNDS_BEFORE_REVIEW[p.box];
}

/**
 * Chooses the words for one round, in play order.
 * About 30% of the round is review (due words: lowest box first, then longest unseen).
 * The rest are words of the player's level, never-seen ones first, then any other candidate.
 * Never repeats a word; returns fewer than `count` only when there are fewer candidates.
 */
export function pickRoundWords(o: {
  candidates: readonly Word[];
  level: Level;
  count: number;
  progress: Readonly<Record<string, WordProgress>>;
  roundNumber: number;
  rng: Rng;
}): Word[] {
  const byId = new Map<string, Word>();
  for (const w of o.candidates) if (!byId.has(w.id)) byId.set(w.id, w);
  const pool = shuffle([...byId.values()], o.rng);

  const picked: Word[] = [];
  const taken = new Set<string>();
  const take = (from: readonly Word[], limit: number): void => {
    for (const w of from) {
      if (limit <= 0) return;
      if (taken.has(w.id)) continue;
      taken.add(w.id);
      picked.push(w);
      limit--;
    }
  };

  const due = pool
    .filter(w => o.progress[w.id] !== undefined && isDue(o.progress[w.id], o.roundNumber))
    .sort((a, b) => {
      const pa = o.progress[a.id], pb = o.progress[b.id];
      return pa.box - pb.box || pa.lastSeenRound - pb.lastSeenRound;
    });
  take(due, Math.round(o.count * REVIEW_SHARE));

  const ofLevel = pool.filter(w => w.level === o.level);
  take(ofLevel.filter(w => o.progress[w.id] === undefined), o.count - picked.length);
  take(ofLevel, o.count - picked.length);
  take(pool, o.count - picked.length);

  return shuffle(picked, o.rng);
}

interface StoredProgress {
  round: number;
  words: Record<string, WordProgress>;
}

function isWordProgress(value: unknown): value is WordProgress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<WordProgress>;
  return (p.box === 1 || p.box === 2 || p.box === 3) && typeof p.lastSeenRound === 'number';
}

/** One player's word progress. Answers are recorded in memory and saved when the round ends. */
export class ProgressStore {
  private readonly storage: StorageService;
  private readonly key: string;
  private round = 0;
  private words: Record<string, WordProgress> = {};

  constructor(storage: StorageService, profileId: string) {
    this.storage = storage;
    this.key = `progress.${profileId}`;
  }

  /** Reads saved progress. Missing or damaged data loads as a fresh start. */
  async load(): Promise<void> {
    const stored = await this.storage.get<Partial<StoredProgress>>(this.key);
    this.round = 0;
    this.words = {};
    if (typeof stored !== 'object' || stored === null) return;
    if (typeof stored.round === 'number' && stored.round >= 0) this.round = stored.round;
    const words: unknown = stored.words;
    if (typeof words !== 'object' || words === null || Array.isArray(words)) return;
    for (const [id, p] of Object.entries(words)) {
      if (isWordProgress(p)) this.words[id] = { box: p.box, lastSeenRound: p.lastSeenRound };
    }
  }

  all(): Readonly<Record<string, WordProgress>> {
    return this.words;
  }

  roundNumber(): number {
    return this.round;
  }

  /** Records one answered word for the current round. Kept in memory until `finishRound`. */
  record(wordId: string, firstTry: boolean): void {
    this.words[wordId] = nextProgress(this.words[wordId], firstTry, this.round);
  }

  /** Closes the current round and saves. */
  async finishRound(): Promise<void> {
    this.round += 1;
    const data: StoredProgress = { round: this.round, words: this.words };
    await this.storage.set(this.key, data);
  }

  /** Words the player knows: box 2 or 3. */
  knownCount(): number {
    return Object.values(this.words).filter(p => p.box >= 2).length;
  }
}
