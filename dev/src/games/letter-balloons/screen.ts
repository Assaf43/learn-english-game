import type { AppContext, Screen } from '../../app/context';
import { COPY } from '../../app/copy';
import { assetUrl, el, preloadImages } from '../../app/dom';
import { gameBar, onTap, speakerButton, startScreen } from '../../app/game-ui';
import { defaultDifficulty } from '../../app/router';
import { ProgressStore, pickRoundWords } from '../../core/progress';
import { shuffle } from '../../core/rng';
import { SettingsStore } from '../../core/settings';
import { starsFromRatio } from '../../core/stars';
import type { Difficulty, Profile, Word } from '../../core/types';
import { levelForGrade, wordById, wordsUpToLevel } from '../../core/wordbank';
import { finishRound } from '../../screens/summary';
import {
  BalloonRound, LB_CONFIG, ROUND_SIZE, TapGuard, WordAttempt, candidatesForLength, distractorLetters, nextSpawn,
} from './logic';

/** Narrowest a balloon is drawn. Its tap area is 20% larger. */
const MIN_BALLOON_PX = 72;
const MAX_BALLOON_PX = 104;
const HIT_SCALE = 1.2;
/** A balloon is this much taller than it is wide, knot included. */
const BALLOON_ASPECT = 1.25;
/** Most balloons on screen: fewer on a narrow phone. */
const NARROW_SCREEN_PX = 480;
const MAX_BALLOONS_NARROW = 7;
const MAX_BALLOONS_WIDE = 10;
/** Shortest time between two balloons entering, so they do not all start side by side. */
const SPAWN_GAP_MS = 700;
/** How long the Hebrew translation shows before the next word. */
const TRANSLATION_MS = 1500;
const BALLOON_COLOURS = ['var(--coral)', 'var(--sun)', 'var(--leaf)', 'var(--lilac)', '#8fd8f2'];

const BULB_ICON =
  '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 5a13 13 0 0 0-7 24v5h14v-5a13 13 0 0 0-7-24z" fill="currentColor"/>' +
  '<path d="M18 38h12M20 43h8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>';

interface Balloon {
  id: number;
  letter: string;
  lane: number;
  /** Top edge, in px from the top of the field. */
  y: number;
  el: HTMLButtonElement;
}

/** Letter Balloons: spell the word by popping its letters in order as they float up. */
export function letterBalloonsScreen(ctx: AppContext): Screen {
  let alive = false;
  const timers = new Set<number>();
  const cleanups: (() => void)[] = [];
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
  };

  function playRound(root: HTMLElement, profile: Profile, progress: ProgressStore, difficulty: Difficulty): void {
    const cfg = LB_CONFIG[difficulty];
    const level = levelForGrade(profile.grade);
    const roundWords = pickRoundWords({
      candidates: candidatesForLength(wordsUpToLevel(level), cfg), level, count: ROUND_SIZE,
      progress: progress.all(), roundNumber: progress.roundNumber(), rng: ctx.rng,
    });
    const round = new BalloonRound(roundWords.map(w => w.id));
    const shown = (letter: string): string => (cfg.uppercase ? letter.toUpperCase() : letter);
    preloadImages(roundWords.map(w => assetUrl(w.image)));

    // Screen. The picture shows which word to spell; the translation appears over the field when the word is done.
    const bar = gameBar(() => ctx.navigate({ name: 'home' }));
    const slots = el('div', { class: 'lb-slots en', dir: 'ltr', lang: 'en' });
    const picture = el('img', { class: 'lb-picture', alt: '', draggable: 'false' });
    const translation = el('div', { class: 'lb-he', 'aria-live': 'polite' });
    const bulb = el('button', { class: 'icon-btn lb-bulb', type: 'button', 'aria-label': 'hint' });
    bulb.innerHTML = `<span class="icon">${BULB_ICON}</span>`;
    const field = el('div', { class: 'lb-field' }, translation);
    root.replaceChildren(
      el('div', { class: 'game lb' },
        bar.element,
        el('div', { class: 'lb-panel' },
          slots,
          el('div', { class: 'lb-row' }, speakerButton(() => say()), el('div', { class: 'lb-picture-box' }, picture), bulb),
        ),
        field,
      ),
    );

    // State of the word being played
    let word: Word | undefined;
    let attempt: WordAttempt | undefined;
    let active = false;
    let queue: string[] = [];
    let balloons: Balloon[] = [];
    let guard = new TapGuard();
    let nextId = 0;
    let lastSpawnAt = 0;
    let completed = 0;
    const say = (): void => {
      if (word) void ctx.audio.play(word.id, word.en);
    };

    // Geometry, measured from the field
    let fieldW = 0, fieldH = 0, hitW = 0, hitH = 0, lanes = 1, maxOnScreen = MAX_BALLOONS_WIDE;
    const measure = (): void => {
      const rect = field.getBoundingClientRect();
      fieldW = rect.width;
      fieldH = rect.height;
      const balloonW = Math.min(MAX_BALLOON_PX, Math.max(MIN_BALLOON_PX, fieldW / 8));
      hitW = balloonW * HIT_SCALE;
      hitH = balloonW * BALLOON_ASPECT * HIT_SCALE;
      lanes = Math.max(1, Math.floor(fieldW / hitW));
      maxOnScreen = window.innerWidth < NARROW_SCREEN_PX ? MAX_BALLOONS_NARROW : MAX_BALLOONS_WIDE;
      field.style.setProperty('--balloon-w', `${balloonW}px`);
      field.style.setProperty('--hit-w', `${hitW}px`);
      field.style.setProperty('--hit-h', `${hitH}px`);
    };
    const laneX = (lane: number): number => (fieldW / lanes) * (lane + 0.5) - hitW / 2;
    const place = (b: Balloon): void => {
      b.el.style.transform = `translate(${laneX(b.lane)}px, ${b.y}px)`;
    };
    /** Lanes whose bottom is empty, so a balloon can enter without touching the one above it. */
    const freeLanes = (): number[] => {
      const free: number[] = [];
      for (let lane = 0; lane < lanes; lane++) {
        if (balloons.every(b => b.lane !== lane || b.y <= fieldH - hitH - 4)) free.push(lane);
      }
      return free;
    };

    const renderSlots = (): void => {
      if (!word || !attempt) return;
      const filled = attempt.filled();
      slots.style.setProperty('--n', String(word.en.length));
      slots.replaceChildren(
        ...word.en.split('').map((letter, i) =>
          el('span', { class: i < filled.length ? 'lb-slot is-filled' : 'lb-slot' }, i < filled.length ? shown(letter) : '')),
      );
    };

    const updateGlow = (): void => {
      const needed = attempt?.shouldGlow() ? attempt.nextLetter() : null;
      const target = needed === null ? undefined : balloons.find(b => b.letter === needed);
      for (const b of balloons) b.el.classList.toggle('is-glow', b === target);
    };

    const onPop = (b: Balloon): void => {
      if (!active || !attempt || !balloons.includes(b)) return;
      if (!guard.accept(b.id, performance.now())) return;
      const result = attempt.pop(b.letter);
      if (result === 'ignored') return;

      if (result === 'wrong') {
        // The balloon wobbles aside and stays. No sound.
        b.el.classList.remove('is-wrong');
        void b.el.offsetWidth;
        b.el.classList.add('is-wrong');
        updateGlow();
        return;
      }

      balloons = balloons.filter(other => other !== b);
      b.el.classList.add('is-popped');
      later(() => b.el.remove(), 250);
      renderSlots();
      updateGlow();
      if (attempt.done()) completeWord();
    };

    const spawn = (letter: string, lane: number, y: number): void => {
      const queued = queue.indexOf(letter);
      if (queued >= 0) queue.splice(queued, 1);
      const id = nextId++;
      const button = el('button', { class: 'lb-balloon', type: 'button', 'aria-label': shown(letter) },
        el('span', { class: 'lb-body' }, el('span', { class: 'lb-letter en', dir: 'ltr' }, shown(letter))),
      );
      button.style.setProperty('--balloon', BALLOON_COLOURS[id % BALLOON_COLOURS.length]);
      const balloon: Balloon = { id, letter, lane, y, el: button };
      onTap(button, () => onPop(balloon));
      balloons.push(balloon);
      place(balloon);
      field.append(button);
    };

    /**
     * Starts a word with one balloon in each lane, at different heights in the
     * lower half of the field, so the field is not empty and nothing leaves at once.
     */
    const seed = (): void => {
      const top = Math.max(0, fieldH - hitH);
      for (const lane of shuffle(Array.from({ length: lanes }, (_, i) => i), ctx.rng)) {
        if (balloons.length >= maxOnScreen) break;
        const letter = nextSpawn(attempt?.nextLetter() ?? null, balloons.map(b => b.letter), queue);
        if (letter === null) break;
        spawn(letter, lane, top * (0.5 + 0.5 * ctx.rng()));
      }
      lastSpawnAt = performance.now();
    };

    const clearBalloons = (): void => {
      for (const b of balloons) {
        b.el.classList.add('is-leaving');
        const element = b.el;
        later(() => element.remove(), 300);
      }
      balloons = [];
    };

    const finish = (): void => {
      active = false;
      const items = round.items();
      const stars = starsFromRatio(round.cleanCount(), items.length);
      void finishRound(ctx, profile.id, { game: 'letter-balloons', difficulty, items, stars }, progress);
    };

    const startWord = (): void => {
      word = wordById(round.current() ?? '');
      if (!word) {
        finish();
        return;
      }
      attempt = new WordAttempt(word.en, cfg);
      guard = new TapGuard();
      const remaining = word.en.slice(attempt.filled().length).split('');
      queue = shuffle([...remaining, ...distractorLetters(word.en, cfg, ctx.rng)], ctx.rng);
      picture.src = assetUrl(word.image);
      translation.textContent = '';
      translation.classList.remove('is-shown');
      // Retried words come after the last word, so the strip stays at the end for them.
      const total = round.items().length;
      bar.update({ index: Math.min(completed, total - 1), total });
      renderSlots();
      active = true;
      seed();
      if (cfg.autoAudio) say();
    };

    const completeWord = (): void => {
      if (!word || !attempt) return;
      active = false;
      const clean = attempt.clean();
      // Word progress comes from the first attempt only, not from the retry.
      if (!round.isRetry()) progress.record(word.id, clean);
      clearBalloons();
      say();
      translation.textContent = word.he;
      translation.classList.add('is-shown');
      later(() => {
        round.complete(clean);
        completed += 1;
        startWord();
      }, TRANSLATION_MS);
    };

    // Balloons rise at a steady speed. One leaving the top goes back to the
    // front of the queue, so it comes in again from the bottom soon after.
    let lastFrame = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      frame = window.requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (!active || !attempt) return;

      for (const b of balloons) {
        b.y -= cfg.speed * dt;
        if (b.y + hitH < 0) {
          b.el.remove();
          queue.unshift(b.letter);
        } else {
          place(b);
        }
      }
      balloons = balloons.filter(b => b.y + hitH >= 0);

      if (balloons.length < maxOnScreen && now - lastSpawnAt >= SPAWN_GAP_MS) {
        const free = freeLanes();
        const letter = free.length > 0 ? nextSpawn(attempt.nextLetter(), balloons.map(b => b.letter), queue) : null;
        if (letter !== null) {
          spawn(letter, free[Math.floor(ctx.rng() * free.length)], fieldH);
          lastSpawnAt = now;
        }
      }
      updateGlow();
    };

    // When the field changes size (the phone was turned), balloons are laid out again.
    const observer = new ResizeObserver(() => {
      const rect = field.getBoundingClientRect();
      if (Math.abs(rect.width - fieldW) < 1 && Math.abs(rect.height - fieldH) < 1) return;
      measure();
      if (!active) return;
      queue.unshift(...balloons.map(b => b.letter));
      for (const b of balloons) b.el.remove();
      balloons = [];
      seed();
    });

    onTap(bulb, () => {
      if (!active || !attempt) return;
      attempt.useHint();
      updateGlow();
    });

    measure();
    observer.observe(field);
    frame = window.requestAnimationFrame(tick);
    cleanups.push(() => window.cancelAnimationFrame(frame), () => observer.disconnect());
    startWord();
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
      const [last] = await Promise.all([settings.lastDifficulty('letter-balloons'), progress.load()]);
      if (!alive) return;

      root.replaceChildren(
        startScreen({
          title: COPY.games['letter-balloons'],
          difficulty: last ?? defaultDifficulty(profile.grade),
          onStart: difficulty => {
            ctx.audio.unlock();
            void settings.setDifficulty('letter-balloons', difficulty);
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
      cleanups.forEach(stop => stop());
      cleanups.length = 0;
    },
  };
}
