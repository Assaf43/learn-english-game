import { shuffle, type Rng } from '../../core/rng';
import type { Difficulty, Word } from '../../core/types';

/** How the options for one item are chosen. `pictures` counts the correct answer too. */
export interface PickConfig {
  pictures: number;
  /** How many wrong options come from the target's own category. */
  sameCategory: number;
  preferSameFirstLetter: boolean;
}

export interface WOConfig extends PickConfig {
  /** Pictures move slowly while the item is on screen. */
  drift: boolean;
  /** When the word is spoken: as it appears, only on the speaker button, or only once answered. */
  audio: 'auto' | 'tap' | 'after';
}

export const WO_CONFIG: Record<Difficulty, WOConfig> = {
  easy: { pictures: 4, sameCategory: 0, preferSameFirstLetter: false, drift: false, audio: 'auto' },
  medium: { pictures: 6, sameCategory: 3, preferSameFirstLetter: false, drift: false, audio: 'tap' },
  hard: { pictures: 9, sameCategory: 6, preferSameFirstLetter: true, drift: true, audio: 'after' },
};

export const ROUND_SIZE = 10;

/** Options in picture-to-word mode: 3 words on easy, 4 on medium and hard, same choosing rules. */
export function reverseConfig(difficulty: Difficulty): PickConfig {
  const { sameCategory, preferSameFirstLetter } = WO_CONFIG[difficulty];
  return { pictures: difficulty === 'easy' ? 3 : 4, sameCategory, preferSameFirstLetter };
}

/**
 * The options shown for `target`, shuffled, with the target exactly once.
 * Wrong options never include a word that could be mistaken for the target
 * (`confusableWith`, in either direction) and never repeat. When one group
 * (same category / other categories) is too small, the other fills in, so the
 * result is shorter than `cfg.pictures` only when the pool itself is too small.
 */
export function buildOptions(target: Word, pool: readonly Word[], cfg: PickConfig, rng: Rng): Word[] {
  const seen = new Set<string>([target.id]);
  const usable: Word[] = [];
  for (const w of pool) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    if (target.confusableWith?.includes(w.id) || w.confusableWith?.includes(target.id)) continue;
    usable.push(w);
  }

  let same = shuffle(usable.filter(w => w.category === target.category), rng);
  const other = shuffle(usable.filter(w => w.category !== target.category), rng);
  if (cfg.preferSameFirstLetter) {
    const sameLetter = (w: Word): boolean => w.en[0] === target.en[0];
    same = [...same.filter(sameLetter), ...same.filter(w => !sameLetter(w))];
  }

  const needed = Math.max(0, cfg.pictures - 1);
  const fromSame = same.slice(0, Math.min(cfg.sameCategory, needed));
  const fromOther = other.slice(0, needed - fromSame.length);
  const spare = [...same.slice(fromSame.length), ...other.slice(fromOther.length)];
  const distractors = [...fromSame, ...fromOther, ...spare].slice(0, needed);

  return shuffle([target, ...distractors], rng);
}

/**
 * The taps on one item's options. A second tap on an option that was already
 * tapped, and any tap after the right answer, is ignored, so a double tap or
 * two fingers on the same answer count once.
 */
export class ItemTaps {
  private readonly targetId: string;
  private readonly open: Set<string>;
  private answered = false;

  constructor(targetId: string, optionIds: readonly string[]) {
    this.targetId = targetId;
    this.open = new Set(optionIds);
  }

  tap(optionId: string): 'correct' | 'wrong' | 'ignored' {
    if (this.answered || !this.open.has(optionId)) return 'ignored';
    this.open.delete(optionId);
    if (optionId !== this.targetId) return 'wrong';
    this.answered = true;
    return 'correct';
  }

  /** The right answer was tapped. */
  done(): boolean {
    return this.answered;
  }
}
