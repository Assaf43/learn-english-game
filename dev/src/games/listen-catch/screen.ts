import type { AppContext, Screen } from '../../app/context';
import { COPY } from '../../app/copy';
import { assetUrl, el, preloadImages } from '../../app/dom';
import { gameBar, onTap, speakerButton, startScreen } from '../../app/game-ui';
import { defaultDifficulty } from '../../app/router';
import { ProgressStore, pickRoundWords } from '../../core/progress';
import { RoundTracker } from '../../core/round';
import { SettingsStore } from '../../core/settings';
import { starsFromRatio } from '../../core/stars';
import type { Difficulty, Profile, Word } from '../../core/types';
import { levelForGrade, wordsUpToLevel } from '../../core/wordbank';
import { finishRound } from '../../screens/summary';
import { ItemTaps, buildOptions } from '../word-object/logic';
import { COLOURS, NOUNS, ROUND_SIZE, SIZES, buildScenes, phraseId, phraseText, type Thing } from './scene';

/** Pause after the right answer before the next item. Taps in this time are ignored. */
const ADVANCE_MS = 900;
/** The turtle button, and the replay after a wrong tap, speak at this rate. */
const SLOW_RATE = 0.6;
const EASY_PICTURES = { pictures: 3, sameCategory: 0, preferSameFirstLetter: false } as const;

/** One thing to listen for, with the pictures to choose from. */
interface Item {
  id: string;
  /** What is said: the audio id and its text. */
  audioId: string;
  text: string;
  options: { key: string; image: string; picture(): HTMLElement }[];
  /** Set on the easy level, where the item is a word from the word bank. */
  word?: Word;
}

function wordPicture(word: Word): HTMLElement {
  return el('img', { class: 'lc-picture', src: assetUrl(word.image), alt: '', draggable: 'false' });
}

function shapeUrl(thing: Pick<Thing, 'noun'>): string {
  return assetUrl(`img/shapes/${thing.noun}.svg`);
}

function thingPicture(thing: Thing): HTMLElement {
  const shape = el('span', { class: 'lc-shape' });
  shape.style.setProperty('--shape', `url("${shapeUrl(thing)}")`);
  shape.style.setProperty('--colour', COLOURS[thing.colour]);
  shape.style.setProperty('--scale', String(SIZES[thing.size ?? 'big']));
  return el('span', { class: 'lc-outline' }, shape);
}

/** Listen and Catch: hear a word or a phrase and tap the matching picture. Nothing is written on screen. */
export function listenCatchScreen(ctx: AppContext): Screen {
  let alive = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
  };

  function buildItems(profile: Profile, progress: ProgressStore, difficulty: Difficulty): Item[] {
    if (difficulty !== 'easy') {
      return buildScenes(difficulty, ROUND_SIZE, ctx.rng).map(scene => ({
        id: phraseId(scene.target),
        audioId: phraseId(scene.target),
        text: phraseText(scene.target),
        options: scene.options.map(thing => ({ key: phraseId(thing), image: shapeUrl(thing), picture: () => thingPicture(thing) })),
      }));
    }
    const level = levelForGrade(profile.grade);
    const pool = wordsUpToLevel(level);
    const words = pickRoundWords({
      candidates: pool, level, count: ROUND_SIZE,
      progress: progress.all(), roundNumber: progress.roundNumber(), rng: ctx.rng,
    });
    return words.map(word => ({
      id: word.id,
      audioId: word.id,
      text: word.en,
      options: buildOptions(word, pool, EASY_PICTURES, ctx.rng).map(option => ({ key: option.id, image: assetUrl(option.image), picture: () => wordPicture(option) })),
      word,
    }));
  }

  function playRound(root: HTMLElement, profile: Profile, progress: ProgressStore, difficulty: Difficulty): void {
    const items = new Map(buildItems(profile, progress, difficulty).map(item => [item.id, item]));
    preloadImages([...items.values()].flatMap(item => item.options.map(option => option.image)));
    const tracker = new RoundTracker([...items.keys()]);
    const recorded = new Set<string>();
    let current: Item | undefined;
    const say = (rate: number): void => {
      if (current) void ctx.audio.play(current.audioId, current.text, { rate });
    };

    const bar = gameBar(() => ctx.navigate({ name: 'home' }));
    const turtle = el('button', { class: 'icon-btn lc-turtle', type: 'button', 'aria-label': 'slow audio' },
      el('img', { src: assetUrl('img/words/turtle.svg'), alt: '', draggable: 'false' }),
    );
    onTap(turtle, () => say(SLOW_RATE));
    const controls = el('div', { class: 'lc-controls' }, speakerButton(() => say(1), 'lc-speaker'), turtle);
    const grid = el('div', { class: 'lc-grid' });
    root.replaceChildren(el('div', { class: 'game lc' }, bar.element, el('div', { class: 'lc-stage' }, controls, grid)));

    const finish = (): void => {
      const results = tracker.items();
      const stars = starsFromRatio(tracker.firstTryCount(), results.length);
      void finishRound(ctx, profile.id, { game: 'listen-catch', difficulty, items: results, stars }, progress);
    };

    const showItem = (): void => {
      const item = items.get(tracker.currentId());
      if (!item) {
        finish();
        return;
      }
      current = item;
      const taps = new ItemTaps(item.id, item.options.map(o => o.key));
      const buttons = new Map<string, HTMLButtonElement>();
      bar.update(tracker.position());

      const onOption = (key: string): void => {
        const result = taps.tap(key);
        const button = buttons.get(key);
        if (result === 'ignored' || !button) return;

        if (result === 'correct') {
          const { wrongCount } = tracker.answer(true);
          // Word progress is kept on the easy level only, and only for the first time an item is played.
          if (item.word && !recorded.has(item.id)) {
            recorded.add(item.id);
            progress.record(item.word.id, wrongCount === 0);
          }
          button.classList.remove('is-glow');
          button.classList.add('is-correct');
          later(() => (tracker.next() ? showItem() : finish()), ADVANCE_MS);
          return;
        }

        const { reveal } = tracker.answer(false);
        tracker.requeueCurrent();
        button.classList.add('is-gone');
        button.setAttribute('aria-disabled', 'true');
        say(SLOW_RATE);
        if (reveal) buttons.get(item.id)?.classList.add('is-glow');
      };

      grid.dataset.count = String(item.options.length);
      grid.replaceChildren(
        ...item.options.map((option, i) => {
          const button = el('button', { class: 'lc-option', type: 'button', 'aria-label': String(i + 1) }, option.picture());
          buttons.set(option.key, button);
          onTap(button, () => onOption(option.key));
          return button;
        }),
      );
      say(1);
    };

    showItem();
  }

  return {
    async mount(root: HTMLElement): Promise<void> {
      alive = true;
      const profile = await ctx.profiles.current();
      if (!alive) return;
      if (!profile) {
        ctx.navigate({ name: 'who' });
        return;
      }
      const settings = new SettingsStore(ctx.storage, profile.id);
      const progress = new ProgressStore(ctx.storage, profile.id);
      const [last] = await Promise.all([settings.lastDifficulty('listen-catch'), progress.load()]);
      if (!alive) return;
      // The shapes are tiny; loading them now means they are ready when the round starts.
      preloadImages(NOUNS.map(noun => shapeUrl({ noun })));

      root.replaceChildren(
        startScreen({
          title: COPY.games['listen-catch'],
          difficulty: last ?? defaultDifficulty(profile.grade),
          onStart: difficulty => {
            ctx.audio.unlock();
            void settings.setDifficulty('listen-catch', difficulty);
            playRound(root, profile, progress, difficulty);
          },
          onBack: () => ctx.navigate({ name: 'home' }),
        }),
      );
    },
    unmount(): void {
      alive = false;
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    },
  };
}
