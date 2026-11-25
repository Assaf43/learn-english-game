import type { RoundItem } from './types';

/** Wrong answers on one item after which the correct answer is revealed. */
const REVEAL_AFTER_WRONG = 2;

/**
 * Follows one round: which item is current, how many wrong answers it got,
 * and whether each item was answered right on the first try.
 */
export class RoundTracker {
  /** The round's items, in order, without repeats. */
  private readonly ids: string[];
  /** `ids` followed by any re-queued items. */
  private readonly queue: string[];
  private readonly requeued = new Set<string>();
  private readonly firstTry = new Map<string, boolean>();
  private index = 0;
  private over: boolean;
  /** Wrong answers on the current item in this pass. */
  private wrong = 0;
  /** The current item was answered correctly in this pass. */
  private answered = false;

  constructor(ids: readonly string[]) {
    this.ids = [...new Set(ids)];
    this.queue = [...this.ids];
    this.over = this.ids.length === 0;
  }

  currentId(): string {
    return this.queue[this.index];
  }

  /** Position for a progress display. `total` excludes re-queued items. */
  position(): { index: number; total: number } {
    const total = this.ids.length;
    return { index: Math.min(this.index, Math.max(0, total - 1)), total };
  }

  /**
   * Records an answer to the current item. Answers after the item was already
   * answered correctly (a double tap) or after the round ended are ignored.
   */
  answer(correct: boolean): { wrongCount: number; reveal: boolean } {
    if (!this.over && !this.answered) {
      if (correct) {
        this.answered = true;
        if (this.isFirstPass()) this.firstTry.set(this.currentId(), this.wrong === 0);
      } else {
        this.wrong += 1;
      }
    }
    return { wrongCount: this.wrong, reveal: this.wrong >= REVEAL_AFTER_WRONG };
  }

  /** Plays the current item once more at the end of the round. At most once per item; first-try results do not change. */
  requeueCurrent(): void {
    if (this.over) return;
    const id = this.currentId();
    if (this.requeued.has(id)) return;
    this.requeued.add(id);
    this.queue.push(id);
  }

  /** Moves to the next item. Returns false when the round is over. */
  next(): boolean {
    if (this.over) return false;
    if (this.index + 1 >= this.queue.length) {
      this.over = true;
      return false;
    }
    this.index += 1;
    this.wrong = 0;
    this.answered = false;
    return true;
  }

  /** One result per item of the round, in the original order. */
  items(): RoundItem[] {
    return this.ids.map(wordId => ({ wordId, firstTry: this.firstTry.get(wordId) === true }));
  }

  firstTryCount(): number {
    return this.items().filter(item => item.firstTry).length;
  }

  private isFirstPass(): boolean {
    return this.index < this.ids.length;
  }
}
