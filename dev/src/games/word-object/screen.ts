import type { AppContext, Screen } from '../../app/context';
import { COPY } from '../../app/copy';
import { assetUrl, el } from '../../app/dom';
import { choicePills, gameBar, onTap, speakerButton, startScreen } from '../../app/game-ui';
import { defaultDifficulty } from '../../app/router';
import { ProgressStore, pickRoundWords } from '../../core/progress';
import { RoundTracker } from '../../core/round';
import { SettingsStore } from '../../core/settings';
import { starsFromRatio } from '../../core/stars';
import type { Difficulty, Profile, Word } from '../../core/types';
import { levelForGrade, wordById, wordsUpToLevel } from '../../core/wordbank';
import { finishRound } from '../../screens/summary';
import { ItemTaps, ROUND_SIZE, WO_CONFIG, buildOptions, reverseConfig } from './logic';

type Mode = 'word-to-picture' | 'picture-to-word';

/** Pause after a right answer before the next word. Taps in this time are ignored. */
const ADVANCE_MS = 1000;
/** How long a wrong option shows its name before it dims. */
const DIM_AFTER_MS = 900;

/** Word and Object: match an English word with its picture, in either direction. */
export function wordObjectScreen(ctx: AppContext): Screen {
  let alive = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
  };
  const say = (word: Word): void => void ctx.audio.play(word.id, word.en);

  function playRound(root: HTMLElement, profile: Profile, progress: ProgressStore, difficulty: Difficulty, mode: Mode): void {
    const cfg = WO_CONFIG[difficulty];
    const level = levelForGrade(profile.grade);
    const pool = wordsUpToLevel(level);
    const roundWords = pickRoundWords({
      candidates: pool, level, count: ROUND_SIZE,
      progress: progress.all(), roundNumber: progress.roundNumber(), rng: ctx.rng,
    });
    const tracker = new RoundTracker(roundWords.map(w => w.id));
    const bar = gameBar(() => ctx.navigate({ name: 'home' }));
    const stage = el('div', { class: 'wo-stage' });
    root.replaceChildren(el('div', { class: 'game wo' }, bar.element, stage));

    const finish = (): void => {
      const items = tracker.items();
      const stars = starsFromRatio(tracker.firstTryCount(), items.length);
      void finishRound(ctx, profile.id, { game: 'word-object', difficulty, items, stars }, progress);
    };

    const showItem = (): void => {
      const target = wordById(tracker.currentId());
      if (!target) {
        finish();
        return;
      }
      const forward = mode === 'word-to-picture';
      const options = buildOptions(target, pool, forward ? cfg : reverseConfig(difficulty), ctx.rng);
      const taps = new ItemTaps(target.id, options.map(o => o.id));
      const buttons = new Map<string, HTMLButtonElement>();
      bar.update(tracker.position());

      const onOption = (option: Word): void => {
        const result = taps.tap(option.id);
        const button = buttons.get(option.id);
        if (result === 'ignored' || !button) return;

        if (result === 'correct') {
          const { wrongCount } = tracker.answer(true);
          progress.record(target.id, wrongCount === 0);
          buttons.forEach(b => b.classList.remove('is-glow'));
          button.classList.add('is-correct');
          say(target);
          later(() => (tracker.next() ? showItem() : finish()), ADVANCE_MS);
          return;
        }

        const { reveal } = tracker.answer(false);
        button.classList.add('is-wrong');
        button.setAttribute('aria-disabled', 'true');
        say(option);
        later(() => button.classList.add('is-dim'), DIM_AFTER_MS);
        if (reveal) buttons.get(target.id)?.classList.add('is-glow');
      };

      const optionButtons = options.map((option, i) => {
        const button = forward
          ? el('button', { class: 'wo-option', type: 'button', 'aria-label': String(i + 1) },
              el('img', { src: assetUrl(option.image), alt: '', draggable: 'false' }),
              el('span', { class: 'wo-name en', dir: 'ltr', lang: 'en' }, option.en),
            )
          : el('button', { class: 'wo-option wo-option-word', type: 'button' },
              el('img', { class: 'wo-hint', src: assetUrl(option.image), alt: '', draggable: 'false' }),
              el('span', { class: 'en', dir: 'ltr', lang: 'en' }, option.en),
            );
        buttons.set(option.id, button);
        onTap(button, () => onOption(option));
        return button;
      });

      const prompt = el('div', { class: 'wo-prompt' },
        forward
          ? el('span', { class: 'wo-word en', dir: 'ltr', lang: 'en' }, target.en)
          : el('img', { class: 'wo-picture', src: assetUrl(target.image), alt: '', draggable: 'false' }),
        cfg.audio !== 'after' && speakerButton(() => say(target)),
      );
      const columns = forward ? (options.length <= 4 ? 2 : 3) : 1;
      const grid = el('div', {
        class: `wo-grid ${forward ? 'wo-grid-pictures' : 'wo-grid-words'}${forward && cfg.drift ? ' is-drifting' : ''}`,
        'data-count': options.length,
        style: `--cols: ${columns}; --rows: ${Math.ceil(options.length / columns)}`,
      }, ...optionButtons);

      stage.replaceChildren(prompt, grid);
      if (cfg.audio === 'auto') say(target);
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
      const [last] = await Promise.all([settings.lastDifficulty('word-object'), progress.load()]);
      if (!alive) return;

      const mode = choicePills<Mode>({
        name: 'mode',
        label: COPY.games['word-object'],
        options: [
          { value: 'word-to-picture', text: COPY.modeWordToPicture },
          { value: 'picture-to-word', text: COPY.modePictureToWord },
        ],
        selected: 'word-to-picture',
      });

      root.replaceChildren(
        startScreen({
          title: COPY.games['word-object'],
          difficulty: last ?? defaultDifficulty(profile.grade),
          extra: mode.element,
          onStart: difficulty => {
            ctx.audio.unlock();
            void settings.setDifficulty('word-object', difficulty);
            playRound(root, profile, progress, difficulty, mode.value());
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
