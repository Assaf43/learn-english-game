import type { Difficulty } from '../core/types';
import { COPY } from './copy';
import { el } from './dom';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Simple icons drawn for this project. */
const ICON = {
  speaker:
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 18h9l11-9v30l-11-9H6z" fill="currentColor"/>' +
    '<path d="M32 17q5 7 0 14M37 11q10 13 0 26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  home:
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M5 24 24 6l19 18h-6v17H28V30h-8v11h-9V24z" fill="currentColor"/></svg>',
} as const;

function icon(name: keyof typeof ICON): HTMLElement {
  const span = el('span', { class: 'icon' });
  span.innerHTML = ICON[name];
  return span;
}

/**
 * Runs `handler` when the element is tapped. In-game answers react on
 * `pointerdown`, which is quicker than `click` on touch screens. A click
 * that came from the keyboard (Enter or Space) counts too.
 */
export function onTap(target: HTMLElement, handler: () => void): void {
  target.addEventListener('pointerdown', event => {
    if (event.button === 0) handler();
  });
  target.addEventListener('click', event => {
    if (event.detail === 0) handler();
  });
}

/** A row of choices where exactly one is selected. */
export function choicePills<T extends string>(o: {
  name: string;
  label: string;
  options: readonly { value: T; text: string }[];
  selected: T;
}): { element: HTMLElement; value(): T } {
  const element = el('fieldset', { class: 'field', 'aria-label': o.label },
    el('div', { class: 'pills', style: `--pill-count: ${o.options.length}` },
      ...o.options.map(option =>
        el('label', { class: 'pill' },
          el('input', { type: 'radio', name: o.name, value: option.value, checked: option.value === o.selected }),
          el('span', {}, option.text),
        )),
    ),
  );
  return {
    element,
    value: () => (element.querySelector<HTMLInputElement>('input:checked')?.value as T | undefined) ?? o.selected,
  };
}

/**
 * A game's first screen: its name, the difficulty choice, anything extra the
 * game adds, and "התחל". The start button listens for `click`, because browsers
 * only let sound start from a completed tap.
 */
export function startScreen(o: {
  title: string;
  difficulty: Difficulty;
  extra?: HTMLElement;
  onStart(difficulty: Difficulty): void;
  onBack(): void;
}): HTMLElement {
  const difficulty = choicePills({
    name: 'difficulty',
    label: o.title,
    options: DIFFICULTIES.map(value => ({ value, text: COPY.difficulty[value] })),
    selected: o.difficulty,
  });
  const start = el('button', { class: 'btn btn-primary btn-start', type: 'button' }, COPY.start);
  start.addEventListener('click', () => {
    start.disabled = true;
    o.onStart(difficulty.value());
  });
  const back = el('button', { class: 'btn btn-quiet', type: 'button' }, COPY.backHome);
  back.addEventListener('click', o.onBack);

  return el('section', { class: 'start' },
    el('h1', { class: 'page-title' }, o.title),
    difficulty.element,
    o.extra,
    start,
    back,
  );
}

/** The strip at the top of a round: the way home and how far the round has come. */
export function gameBar(onExit: () => void): { element: HTMLElement; update(position: { index: number; total: number }): void } {
  const exit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': COPY.backHome }, icon('home'));
  exit.addEventListener('click', onExit);
  const fill = el('div', { class: 'progress-fill' });
  const track = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0 }, fill);
  const text = el('span', { class: 'progress-text', dir: 'ltr' });

  return {
    element: el('header', { class: 'game-bar' }, exit, track, text),
    update({ index, total }): void {
      const current = Math.min(index + 1, total);
      fill.style.width = `${total > 0 ? (index / total) * 100 : 0}%`;
      track.setAttribute('aria-valuemax', String(total));
      track.setAttribute('aria-valuenow', String(index));
      text.textContent = `${current}/${total}`;
    },
  };
}

/** A round button with a speaker on it. */
export function speakerButton(handler: () => void, extraClass = ''): HTMLButtonElement {
  const button = el('button', { class: `icon-btn speaker-btn ${extraClass}`.trim(), type: 'button', 'aria-label': 'audio' }, icon('speaker'));
  onTap(button, handler);
  return button;
}
