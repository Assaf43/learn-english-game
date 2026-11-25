import { shuffle, type Rng } from '../../core/rng';

export const NOUNS = ['ball', 'star', 'book', 'car', 'hat', 'cup', 'fish', 'apple', 'heart', 'key', 'bell', 'shoe'] as const;
export const COLOURS = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
  black: '#212121',
  pink: '#ec407a',
} as const;
/** How large a thing is drawn, as a share of its tile. */
export const SIZES = { big: 1, small: 0.55 } as const;

export type Noun = typeof NOUNS[number];
export type Colour = keyof typeof COLOURS;
export type Size = keyof typeof SIZES;

/** One coloured shape. `size` is used on the hard level only. */
export interface Thing {
  noun: Noun;
  colour: Colour;
  size?: Size;
}

export interface Scene {
  target: Thing;
  /** The target and its distractors, in the order they are shown. */
  options: Thing[];
}

export const ROUND_SIZE = 10;

const COLOUR_NAMES = Object.keys(COLOURS) as Colour[];
const SIZE_NAMES = Object.keys(SIZES) as Size[];

/** The audio id of the phrase for a thing: `p2-red-ball` or `p3-small-red-ball`. */
export function phraseId(t: Thing): string {
  return t.size ? `p3-${t.size}-${t.colour}-${t.noun}` : `p2-${t.colour}-${t.noun}`;
}

/** What is said for a thing: `a red ball` or `Touch the small red ball`. */
export function phraseText(t: Thing): string {
  return t.size ? `Touch the ${t.size} ${t.colour} ${t.noun}` : `a ${t.colour} ${t.noun}`;
}

/**
 * One item: a target and distractors (4 options on medium, 6 on hard).
 * Every distractor differs from the target in exactly one of noun, colour and
 * size, so the child has to hear every word of the phrase. Each attribute that
 * is in play is varied by at least one distractor.
 */
export function buildScene(difficulty: 'medium' | 'hard', rng: Rng): Scene {
  const hard = difficulty === 'hard';
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const target: Thing = { noun: pick(NOUNS), colour: pick(COLOUR_NAMES) };
  if (hard) target.size = pick(SIZE_NAMES);

  const otherNouns = shuffle(NOUNS.filter(noun => noun !== target.noun), rng).map(noun => ({ ...target, noun }));
  const otherColours = shuffle(COLOUR_NAMES.filter(colour => colour !== target.colour), rng).map(colour => ({ ...target, colour }));
  const otherSizes = hard ? SIZE_NAMES.filter(size => size !== target.size).map(size => ({ ...target, size })) : [];

  // One distractor per attribute first, then more noun and colour changes.
  const distractorCount = hard ? 5 : 3;
  const required: Thing[] = [otherNouns[0], otherColours[0], ...otherSizes];
  const extra = shuffle([...otherNouns.slice(1), ...otherColours.slice(1)], rng);
  const distractors = [...required, ...extra].slice(0, distractorCount);

  return { target, options: shuffle([target, ...distractors], rng) };
}

/** The scenes of one round. No two scenes ask for the same thing. */
export function buildScenes(difficulty: 'medium' | 'hard', count: number, rng: Rng): Scene[] {
  const scenes: Scene[] = [];
  const used = new Set<string>();
  const available = allPhrases().length;
  while (scenes.length < count && used.size < available) {
    const scene = buildScene(difficulty, rng);
    const id = phraseId(scene.target);
    if (used.has(id)) continue;
    used.add(id);
    scenes.push(scene);
  }
  return scenes;
}

/** Every phrase the game can say: 72 without a size and 144 with one. */
export function allPhrases(): { id: string; text: string }[] {
  const things: Thing[] = [];
  for (const colour of COLOUR_NAMES) for (const noun of NOUNS) things.push({ noun, colour });
  for (const size of SIZE_NAMES) for (const colour of COLOUR_NAMES) for (const noun of NOUNS) things.push({ noun, colour, size });
  return things.map(thing => ({ id: phraseId(thing), text: phraseText(thing) }));
}
