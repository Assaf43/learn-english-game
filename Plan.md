# English Games Area (Step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser games area where a child in grades 3-6 picks a profile and plays three English-learning games (Letter Balloons, Listen and Catch, Word and Object), with progress and stars saved on the device.

**Architecture:** A single-page TypeScript app with no framework. Pure logic modules (word selection, scoring, game state) are separated from DOM screens so the logic is unit-tested. All persistence goes through one async `StorageService` interface, so Step 2 can replace localStorage with a cloud backend without touching the games.

**Tech Stack:** TypeScript, Vite (vanilla-ts template), Vitest, plain CSS. No runtime dependencies.

**Spec:** "אזור המשחקים לאנגלית: מסמך עיצוב" (approved 2026-11-24). This plan copies every value the builder needs from it; where the two differ, this plan wins and the difference is listed under "Deviations from the spec".

## Global Constraints

- New, separate project. Do not read, change or depend on the math game's code.
- Step 1 has no server, no accounts, no coupons, no analytics, no network calls except loading the app's own static files.
- Interface text is Hebrew, `dir="rtl"`. English learning content is rendered `dir="ltr"`.
- No timers, no lives, no failure sound, no red X. Feedback on a mistake is visual only.
- After 2 wrong answers on the same item, the correct answer glows.
- Stars are never deducted. A finished round always gives at least 1 star.
- No game code touches `localStorage` directly; only `LocalStorageService` does.
- Audio starts only after a user tap. Every round begins with a "התחל" button that calls `audio.unlock()`.
- Must work with touch and mouse, from a 360 px wide phone to desktop. Tap targets are at least 72 px.
- Use `pointerdown`, not `click`, for in-game taps.
- All randomness goes through an injected `Rng` so tests are deterministic.
- Storage keys are prefixed `eg.`.

## Deviations from the spec

- The spec says each game card shows the words the child knows in that game. Word progress is shared by all three games, so the count of known words (box 2 or 3) is shown once, in the home header. Each card shows only that game's stars.
- The "חשבון" area card is rendered only when the env var `VITE_MATH_GAME_URL` is set. It opens that URL and shares nothing with this app.
- If an audio file is missing or cannot play, the player falls back to the browser's speech synthesis. The shipped game is meant to have every file; the fallback keeps the game playable while files are being produced.
- Listen and Catch records word progress only at the easy level (single words). Medium and hard use generated phrases and only re-queue a missed item inside the round.

## Hebrew interface copy

| Key | Text |
|---|---|
| whoTitle | מי משחק? |
| newPlayer | שחקן חדש |
| name / grade | שם / כיתה |
| grades | ג' ד' ה' ו' |
| start | התחל |
| games | בלוני אותיות / הקשב ותפוס / מילה ואובייקט |
| difficulty | קל / בינוני / קשה |
| modeWordToPicture / modePictureToWord | מילה ← תמונה / תמונה ← מילה |
| summaryTitle | כל הכבוד! |
| practiseWords | מילים לתרגול |
| playAgain / backHome | שחק שוב / חזרה לאזור המשחקים |
| areaEnglish / areaMath | אנגלית / חשבון |
| knownWords | מילים שאני יודע |

## Review Focus

1. Storage unavailable, full, or holding corrupt JSON (private mode on iOS, old data): the app still opens and plays, using memory for that session. Test in Task 2.
2. Audio file missing or `play()` rejected: the game never hangs waiting for sound; it falls back or continues silently. Test in Task 7.
3. Too few words for a round or for distractors (small category, low level): selection widens; never a crash, a duplicate picture, or two valid answers. Tests in Tasks 5 and 9.
4. Fast double tap or two fingers on the same answer: counted once. Tests in Tasks 9 and 11.
5. Profile name empty, only spaces, or very long: rejected or trimmed to 1-20 characters; Hebrew names work. Test in Task 3.

## File Structure

```
index.html                         RTL shell, #app root
src/main.ts                        builds AppContext, starts router
src/app/context.ts                 AppContext type
src/app/router.ts                  Route type, navigate()
src/app/copy.ts                    Hebrew strings (table above)
src/core/types.ts                  shared types
src/core/rng.ts                    seedable random helpers
src/core/storage.ts                StorageService, LocalStorageService, MemoryStorageService
src/core/profiles.ts               ProfileStore
src/core/wordbank.ts               word list access
src/core/progress.ts               ProgressStore, pickRoundWords
src/core/round.ts                  RoundTracker
src/core/stars.ts                  starsFromRatio, StarStore
src/core/audio.ts                  AudioPlayer, FileAudioPlayer
src/data/words.json                the word bank
src/screens/who.ts                 "מי משחק?"
src/screens/home.ts                games area
src/screens/summary.ts             end of round
src/games/word-object/logic.ts     item building
src/games/word-object/screen.ts
src/games/listen-catch/scene.ts    phrase and scene generator
src/games/listen-catch/screen.ts
src/games/letter-balloons/logic.ts word attempt, round, spawn order
src/games/letter-balloons/screen.ts
src/styles/*.css
public/img/words/<id>.svg          Noto Emoji pictures
public/img/shapes/<noun>.svg       12 single-colour shapes
public/img/avatars/<n>.svg         12 avatars
public/audio/<id>.mp3              produced outside this plan (Task 7)
scripts/audio-manifest.ts          lists every audio id and its text
tests/**                           mirrors src/core and src/games/*/logic
ASSETS.md                          asset sources and licences
```

---

### Task 1: Project scaffold, shared types, random helpers

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/core/types.ts`, `src/core/rng.ts`, `tests/core/rng.test.ts`

**Interfaces - Produces:**

```ts
// src/core/types.ts
export type Grade = 3 | 4 | 5 | 6;
export type Level = 1 | 2 | 3 | 4;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameId = 'letter-balloons' | 'listen-catch' | 'word-object';
export type Category = 'animals' | 'food' | 'home' | 'tools' | 'clothes' | 'body' | 'school' | 'transport';
export interface Word {
  id: string; en: string; he: string; image: string; audio: string;
  category: Category; level: Level; trap?: string; confusableWith?: string[];
}
export interface Profile { id: string; name: string; grade: Grade; avatar: string; createdAt: number }
export interface WordProgress { box: 1 | 2 | 3; lastSeenRound: number }
export interface RoundItem { wordId: string; firstTry: boolean }
export interface RoundResult { game: GameId; difficulty: Difficulty; items: RoundItem[]; stars: 1 | 2 | 3 }

// src/core/rng.ts
export type Rng = () => number;                       // [0, 1)
export function mulberry32(seed: number): Rng;
export function shuffle<T>(items: readonly T[], rng: Rng): T[];   // new array
export function sample<T>(items: readonly T[], n: number, rng: Rng): T[]; // up to n, no repeats
```

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template vanilla-ts`, add `vitest` as a dev dependency, add scripts `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`. Set `<html lang="he" dir="rtl">` and a `<div id="app">`.
- [ ] **Step 2:** Write failing tests in `tests/core/rng.test.ts`:

```ts
test('same seed gives same sequence', () => {
  const a = mulberry32(7), b = mulberry32(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test('shuffle keeps all items and does not mutate', () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, mulberry32(1));
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(src).toEqual([1, 2, 3, 4, 5]);
});
test('sample never repeats and caps at length', () => {
  expect(new Set(sample([1, 2, 3], 2, mulberry32(1))).size).toBe(2);
  expect(sample([1, 2, 3], 9, mulberry32(1))).toHaveLength(3);
});
```

- [ ] **Step 3:** Run `npm test`; expect FAIL (module not found).
- [ ] **Step 4:** Implement `types.ts` and `rng.ts`.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`; expect PASS.
- [ ] **Step 6:** Commit: `chore: scaffold project, shared types, rng`.

### Task 2: Storage layer

**Files:** Create `src/core/storage.ts`, `tests/core/storage.test.ts`

**Interfaces - Produces:**

```ts
export interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
export class MemoryStorageService implements StorageService {}
export class LocalStorageService implements StorageService {
  constructor(backend?: Storage);        // defaults to window.localStorage
}
```

The interface is async on purpose: Step 2 swaps in a network implementation.

- [ ] **Step 1:** Write failing tests:

```ts
test('round-trips JSON under the eg. prefix', async () => {
  const fake = fakeStorage();                       // in-test Map-backed Storage
  const s = new LocalStorageService(fake);
  await s.set('profiles', [{ id: 'a' }]);
  expect(fake.getItem('eg.profiles')).toBe('[{"id":"a"}]');
  expect(await s.get('profiles')).toEqual([{ id: 'a' }]);
});
test('corrupt JSON reads as null', async () => {
  const fake = fakeStorage(); fake.setItem('eg.x', '{oops');
  expect(await new LocalStorageService(fake).get('x')).toBeNull();
});
test('when the backend throws, values are kept in memory', async () => {
  const s = new LocalStorageService(throwingStorage());   // setItem/getItem throw
  await s.set('k', 1);
  expect(await s.get('k')).toBe(1);
});
test('missing key reads as null; remove deletes', async () => {
  const s = new MemoryStorageService();
  expect(await s.get('none')).toBeNull();
  await s.set('k', 1); await s.remove('k');
  expect(await s.get('k')).toBeNull();
});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement both classes. `LocalStorageService` never throws: any backend exception switches that key to an internal `Map`.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: storage service with safe fallback`.

### Task 3: Profiles

**Files:** Create `src/core/profiles.ts`, `tests/core/profiles.test.ts`

**Interfaces**
- Consumes: `StorageService`, `Profile`, `Grade`.
- Produces:

```ts
export class InvalidProfileError extends Error {}
export class ProfileStore {
  constructor(storage: StorageService);
  list(): Promise<Profile[]>;                              // oldest first
  add(input: { name: string; grade: Grade; avatar: string }): Promise<Profile>;
  current(): Promise<Profile | null>;                      // last selected
  select(id: string): Promise<void>;
}
```

Keys: `profiles` (array), `currentProfile` (id). `id` comes from `crypto.randomUUID()`. No delete or edit in Step 1.

- [ ] **Step 1:** Write failing tests:

```ts
test('add trims the name and selects the new profile', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  const p = await store.add({ name: '  יובל ', grade: 5, avatar: 'a1' });
  expect(p.name).toBe('יובל');
  expect((await store.current())?.id).toBe(p.id);
});
test.each(['', '   ', 'x'.repeat(21)])('rejects name %j', async (name) => {
  const store = new ProfileStore(new MemoryStorageService());
  await expect(store.add({ name, grade: 4, avatar: 'a1' })).rejects.toBeInstanceOf(InvalidProfileError);
});
test('two profiles are listed oldest first and select switches current', async () => {
  const store = new ProfileStore(new MemoryStorageService());
  const a = await store.add({ name: 'יובל', grade: 5, avatar: 'a1' });
  const b = await store.add({ name: 'אלון', grade: 4, avatar: 'a2' });
  expect((await store.list()).map(p => p.id)).toEqual([a.id, b.id]);
  await store.select(a.id);
  expect((await store.current())?.id).toBe(a.id);
});
test('current is null when the stored id no longer exists', async () => {
  const storage = new MemoryStorageService();
  await storage.set('currentProfile', 'ghost');
  expect(await new ProfileStore(storage).current()).toBeNull();
});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. Name rule: trimmed length 1-20.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: player profiles`.

### Task 4: Word bank and pictures

**Files:** Create `src/data/words.json`, `src/core/wordbank.ts`, `public/img/words/*.svg`, `ASSETS.md`, `tests/core/wordbank.test.ts`

**Interfaces - Produces:**

```ts
export const WORDS: readonly Word[];
export function levelForGrade(grade: Grade): Level;        // grade - 2
export function wordsUpToLevel(level: Level): Word[];
export function wordById(id: string): Word | undefined;
```

**Content rules for `words.json`:**
- About 150 concrete nouns, 8 categories (the `Category` type), at least 12 words per category, at least 30 words per level.
- Level 1 = most basic words for grade 3; level 4 = grade 6. General vocabulary by topic, not tied to a textbook.
- `id` equals `en`; `en` is lowercase, letters a-z only, 3-8 letters.
- At least 15 words of 3-4 letters at level 1 (Letter Balloons easy needs them).
- `image` is `img/words/<id>.svg`; `audio` is `audio/<id>.mp3`.
- `confusableWith` lists words whose pictures could be mistaken for each other (cup/glass, mouse/rat, sofa/chair). Must be symmetric.
- `trap` is one of `silent-e`, `double-letter`, `vowel`, `mirror-letter`, `digraph`, or absent.
- Pictures come from Noto Emoji SVGs (github.com/googlefonts/noto-emoji, `svg/` folder; its README states image resources are under Apache 2.0). Read the repo's LICENSE before copying and record source, licence and file list in `ASSETS.md`.
- A word with no clear, unambiguous Noto picture is left out. Do not draw or generate replacements in Step 1.

- [ ] **Step 1:** Write failing tests:

```ts
test('ids are unique, equal en, a-z, 3-8 letters', () => {
  const ids = WORDS.map(w => w.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const w of WORDS) { expect(w.id).toBe(w.en); expect(w.en).toMatch(/^[a-z]{3,8}$/); expect(w.he.trim()).not.toBe(''); }
});
test('coverage: >=140 words, >=12 per category, >=30 per level, >=15 short level-1 words', () => { /* counts */ });
test('every image file exists', () => { for (const w of WORDS) expect(existsSync(`public/${w.image}`)).toBe(true); });
test('confusableWith is symmetric and points at real ids', () => { /* for each a->b, b lists a */ });
test('levelForGrade maps 3..6 to 1..4', () => { expect([3, 4, 5, 6].map(levelForGrade)).toEqual([1, 2, 3, 4]); });
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Write `words.json`, copy the SVGs, write `ASSETS.md`, implement `wordbank.ts`.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: word bank with pictures`.

### Task 5: Word progress, round selection, round tracking

**Files:** Create `src/core/progress.ts`, `src/core/round.ts`, `tests/core/progress.test.ts`, `tests/core/round.test.ts`

**Interfaces**
- Consumes: `StorageService`, `Word`, `WordProgress`, `Level`, `Rng`, `RoundItem`.
- Produces:

```ts
// progress.ts
export function nextProgress(prev: WordProgress | undefined, firstTry: boolean, round: number): WordProgress;
export function pickRoundWords(o: {
  candidates: readonly Word[]; level: Level; count: number;
  progress: Readonly<Record<string, WordProgress>>; roundNumber: number; rng: Rng;
}): Word[];
export class ProgressStore {
  constructor(storage: StorageService, profileId: string);
  load(): Promise<void>;
  all(): Readonly<Record<string, WordProgress>>;
  roundNumber(): number;
  record(wordId: string, firstTry: boolean): void;          // in memory
  finishRound(): Promise<void>;                             // roundNumber += 1, then save
  knownCount(): number;                                     // box >= 2
}
// round.ts
export class RoundTracker {
  constructor(ids: readonly string[]);
  currentId(): string;
  position(): { index: number; total: number };             // total excludes re-queued items
  answer(correct: boolean): { wrongCount: number; reveal: boolean };  // reveal when wrongCount >= 2
  requeueCurrent(): void;                                   // at most once per id; no effect on firstTry
  next(): boolean;                                          // false when the round is over
  items(): RoundItem[];                                     // one per original id
  firstTryCount(): number;
}
```

Keys: `progress.<profileId>` holds `{ round: number, words: Record<string, WordProgress> }`.

**Rules:**
- `nextProgress`: first try correct moves the box up by 1 (max 3; a new word starts at box 2); otherwise box 1. `lastSeenRound = round`.
- A word is due for review when: box 1 always; box 2 when `roundNumber - lastSeenRound >= 3`; box 3 when `>= 8`.
- `pickRoundWords`: review slots = `Math.round(count * 0.3)`, filled from due words ordered by box then oldest `lastSeenRound`. Remaining slots: words with `level === o.level`, unseen first, random order. If still short, any remaining candidate. Never returns duplicates. Returns fewer than `count` only when `candidates` itself is smaller.
- `RoundTracker.answer` after the item is already answered correctly is ignored (double tap).

- [ ] **Step 1:** Write failing tests:

```ts
test('nextProgress', () => {
  expect(nextProgress(undefined, true, 4)).toEqual({ box: 2, lastSeenRound: 4 });
  expect(nextProgress({ box: 2, lastSeenRound: 1 }, true, 4).box).toBe(3);
  expect(nextProgress({ box: 3, lastSeenRound: 1 }, true, 4).box).toBe(3);
  expect(nextProgress({ box: 3, lastSeenRound: 1 }, false, 4).box).toBe(1);
});
test('10-word round takes 3 due words first, box 1 before box 2', () => { /* 20 candidates, 2 in box1, 2 due in box2 -> both box1 + oldest box2 are included */ });
test('box 2 seen 2 rounds ago is not due; seen 3 rounds ago is', () => {});
test('no duplicates and exact count when enough candidates', () => {});
test('with 4 candidates and count 10 returns the 4', () => {});
test('fills from other levels when the level has too few words', () => {});
test('ProgressStore persists across instances and counts known words', async () => {});
test('RoundTracker: first-try, reveal on second wrong, double correct ignored', () => {
  const r = new RoundTracker(['a', 'b']);
  expect(r.answer(false)).toEqual({ wrongCount: 1, reveal: false });
  expect(r.answer(false)).toEqual({ wrongCount: 2, reveal: true });
  r.answer(true); r.answer(true);
  expect(r.next()).toBe(true);
  r.answer(true);
  expect(r.next()).toBe(false);
  expect(r.items()).toEqual([{ wordId: 'a', firstTry: false }, { wordId: 'b', firstTry: true }]);
});
test('requeueCurrent appends the id once and keeps total', () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: word progress and round selection`.

### Task 6: Stars

**Files:** Create `src/core/stars.ts`, `tests/core/stars.test.ts`

**Interfaces - Produces:**

```ts
export function starsFromRatio(good: number, total: number): 1 | 2 | 3;   // >=0.9 -> 3, >=0.6 -> 2, else 1
export class StarStore {
  constructor(storage: StorageService, profileId: string);
  add(game: GameId, stars: number): Promise<void>;
  totals(): Promise<{ total: number; byGame: Record<GameId, number> }>;
}
```

Key: `stars.<profileId>`.

- [ ] **Step 1:** Write failing tests:

```ts
test.each([[10, 10, 3], [9, 10, 3], [8, 10, 2], [6, 10, 2], [5, 10, 1], [0, 10, 1], [6, 6, 3], [5, 6, 2], [4, 6, 2], [3, 6, 1]])(
  '%i of %i gives %i stars', (g, t, s) => expect(starsFromRatio(g, t)).toBe(s));
test('totals start at zero and add up per game', async () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: stars`.

### Task 7: Audio player and audio manifest

**Files:** Create `src/core/audio.ts`, `scripts/audio-manifest.ts`, `tests/core/audio.test.ts`; Modify `package.json` (script `audio:manifest`)

**Interfaces**
- Consumes: `WORDS`; `allPhrases()` from Task 10 (the script imports it; until Task 10 exists the script lists words only).
- Produces:

```ts
export interface AudioPlayer {
  unlock(): void;                                                  // call inside a user tap
  play(id: string, text: string, opts?: { rate?: number }): Promise<void>;   // resolves when finished; never rejects
}
export class FileAudioPlayer implements AudioPlayer {
  constructor(deps?: { createAudio?: (src: string) => HTMLAudioElement; speech?: SpeechSynthesis | null; baseUrl?: string });
}
export class SilentAudioPlayer implements AudioPlayer {}           // for tests
```

**Rules:**
- `play` loads `<baseUrl>audio/<id>.mp3`, sets `playbackRate = opts.rate ?? 1` with `preservesPitch = true`.
- On load error or a rejected `play()`, speak `text` with `speechSynthesis` (`lang = 'en-US'`, same rate). If speech is unavailable, resolve silently.
- A new `play` call stops the previous sound.
- `play` resolves within 6 seconds even if no end event arrives.
- `npm run audio:manifest` writes `audio-manifest.json`: an array of `{ id, text }` for every word and every Listen and Catch phrase. Producing the mp3 files from this manifest is done outside this plan; the tool is the owner's decision.

- [ ] **Step 1:** Write failing tests with fake audio elements:

```ts
test('plays the file at the requested rate', async () => { /* fake element fires ended; src ends with audio/hammer.mp3; playbackRate 0.6 */ });
test('falls back to speech when the file errors', async () => { /* fake element fires error; fake speech receives text "hammer", lang en-US */ });
test('falls back to speech when play() rejects', async () => {});
test('resolves silently when file fails and speech is null', async () => {
  await expect(new FileAudioPlayer({ createAudio: failingAudio, speech: null }).play('x', 'x')).resolves.toBeUndefined();
});
test('a second play stops the first', async () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `audio.ts` and the manifest script.
- [ ] **Step 4:** Run tests and `npm run audio:manifest`; expect PASS and a JSON file with one entry per word.
- [ ] **Step 5:** Commit: `feat: audio player with fallback, audio manifest`.

### Task 8: App shell: router, "who is playing", home, summary

**Files:** Create `src/app/context.ts`, `src/app/router.ts`, `src/app/copy.ts`, `src/screens/who.ts`, `src/screens/home.ts`, `src/screens/summary.ts`, `src/styles/base.css`, `public/img/avatars/1..12.svg`, `tests/app/router.test.ts`; Modify `src/main.ts`

**Interfaces**
- Consumes: everything from Tasks 2-7.
- Produces:

```ts
// context.ts
export interface AppContext { storage: StorageService; profiles: ProfileStore; audio: AudioPlayer; rng: Rng; navigate(route: Route): void }
export interface Screen { mount(root: HTMLElement): void | Promise<void>; unmount(): void }
// router.ts
export type Route =
  | { name: 'who' } | { name: 'home' }
  | { name: 'game'; game: GameId }
  | { name: 'summary'; result: RoundResult };
export function createRouter(root: HTMLElement, screens: (route: Route, ctx: AppContext) => Screen): { navigate(route: Route): void };
export function defaultDifficulty(grade: Grade): Difficulty;      // 3,4 -> easy; 5,6 -> medium
// summary.ts
export async function finishRound(ctx: AppContext, profileId: string, result: RoundResult, progress: ProgressStore): Promise<void>;
// saves progress (finishRound), adds stars, then navigates to { name: 'summary', result }
```

**Behaviour:**
- Start: no current profile goes to `who`; otherwise `home`.
- `who`: avatar tiles for existing profiles plus a "שחקן חדש" tile opening a form (name, grade ג'-ו', 12 avatars). Avatars are 12 Noto animal faces, recorded in `ASSETS.md`.
- `home`: header with avatar, name, grade, total stars, known-words count; tapping the avatar goes to `who`. Area "אנגלית" with three cards (title and that game's stars). Area "חשבון" with one card only if `import.meta.env.VITE_MATH_GAME_URL` is set. Static illustrated background (a simple CSS/SVG island; no animation). A reserved empty slot in the header for the Step 2 coupons button.
- Each game's own start screen (Tasks 9-11) shows the difficulty selector and "התחל". The last difficulty per game is stored in `settings.<profileId>`; the first default comes from `defaultDifficulty`.
- `summary`: stars, "מילים לתרגול" (each word with `firstTry === false`: picture, English, Hebrew, tap to hear), buttons "שחק שוב" and "חזרה לאזור המשחקים".
- Navigating always calls the previous screen's `unmount()`.

- [ ] **Step 1:** Write failing tests:

```ts
test('navigate unmounts the previous screen before mounting the next', () => { /* spy screens; order: mount A, unmount A, mount B */ });
test('defaultDifficulty', () => { expect([3, 4, 5, 6].map(defaultDifficulty)).toEqual(['easy', 'easy', 'medium', 'medium']); });
test('finishRound saves progress, adds stars, navigates to summary', async () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement router, screens, styles; wire `main.ts` with `LocalStorageService`, `FileAudioPlayer`, `mulberry32(Date.now())`.
- [ ] **Step 4:** Run tests; expect PASS. Run `npm run dev` and check by hand: create two profiles, switch between them, reload keeps the last one, layout holds at 360 px and 1280 px width.
- [ ] **Step 5:** Commit: `feat: app shell and games area`.

**Checkpoint: stop here and show the owner the games area before building the games.**

### Task 9: Word and Object

**Files:** Create `src/games/word-object/logic.ts`, `src/games/word-object/screen.ts`, `src/styles/word-object.css`, `tests/games/word-object.test.ts`

**Interfaces**
- Consumes: `Word`, `Rng`, `pickRoundWords`, `RoundTracker`, `starsFromRatio`, `finishRound`, `AudioPlayer`.
- Produces:

```ts
export interface PickConfig { pictures: number; sameCategory: number; preferSameFirstLetter: boolean }
export interface WOConfig extends PickConfig { drift: boolean; audio: 'auto' | 'tap' | 'after' }
export const WO_CONFIG: Record<Difficulty, WOConfig>;
// easy:   { pictures: 4, sameCategory: 0, preferSameFirstLetter: false, drift: false, audio: 'auto' }
// medium: { pictures: 6, sameCategory: 3, preferSameFirstLetter: false, drift: false, audio: 'tap' }
// hard:   { pictures: 9, sameCategory: 6, preferSameFirstLetter: true,  drift: true,  audio: 'after' }
export function buildOptions(target: Word, pool: readonly Word[], cfg: PickConfig, rng: Rng): Word[];
// shuffled; contains target exactly once; length cfg.pictures when the pool allows
export const ROUND_SIZE = 10;
```

**Rules:**
- Distractors: `sameCategory` of them from the target's category, the rest from other categories. If a group is short, fill from the other group. Never include a word listed in the target's `confusableWith`, never the same word twice.
- With `preferSameFirstLetter`, same-category distractors starting with the target's first letter are chosen first.
- Round: 10 words from `pickRoundWords` with candidates `wordsUpToLevel(levelForGrade(grade))`.
- Screen: the word is large, `dir="ltr"`, and stays visible. Pictures in a grid; with `drift`, pictures move slowly (CSS animation, at most 20 px) and stay tappable.
- Correct: picture grows, success sound is not needed in Step 1, the word is spoken, next word after 1 second.
- Wrong: the tapped picture wobbles, shows its own English name and plays its audio, then dims and is disabled. After the second wrong tap the correct picture glows.
- Audio: `auto` plays the word when it appears; `tap` only on the speaker button; `after` only once answered.
- Mode toggle on the start screen: "מילה ← תמונה" (default) or "תמונה ← מילה". In reverse mode the picture is shown and the child picks among words: 3 options on easy, 4 on medium and hard, same distractor rules.
- Stars: `starsFromRatio(firstTryCount, 10)`. Each answer calls `progress.record(wordId, firstTry)`.

- [ ] **Step 1:** Write failing tests:

```ts
test('easy: 4 options, target once, no same-category distractor', () => {});
test('medium: 6 options with 3 distractors from the target category', () => {});
test('hard: 9 options, same-first-letter distractors preferred', () => {});
test('never includes a confusableWith word', () => {});
test('small pool: returns what exists, no duplicates, target present', () => { /* pool of 3 words, pictures 9 -> length 3 */ });
test('category too small: fills from other categories up to the requested count', () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `logic.ts`, then `screen.ts`. Ignore taps while the 1-second advance is pending (double tap).
- [ ] **Step 4:** Run tests; expect PASS. Play one round at each difficulty and in reverse mode by hand.
- [ ] **Step 5:** Commit: `feat: word and object game`.

### Task 10: Listen and Catch

**Files:** Create `src/games/listen-catch/scene.ts`, `src/games/listen-catch/screen.ts`, `src/styles/listen-catch.css`, `public/img/shapes/*.svg`, `tests/games/listen-catch.test.ts`; Modify `scripts/audio-manifest.ts`

**Interfaces**
- Consumes: `buildOptions`, `RoundTracker`, `pickRoundWords`, `starsFromRatio`, `finishRound`, `AudioPlayer`, `Rng`.
- Produces:

```ts
export const NOUNS = ['ball', 'star', 'book', 'car', 'hat', 'cup', 'fish', 'apple', 'heart', 'key', 'bell', 'shoe'] as const;
export const COLOURS = { red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#fdd835', black: '#212121', pink: '#ec407a' } as const;
export const SIZES = { big: 1, small: 0.55 } as const;
export interface Thing { noun: typeof NOUNS[number]; colour: keyof typeof COLOURS; size?: keyof typeof SIZES }
export function phraseId(t: Thing): string;      // 'p2-red-ball' or 'p3-small-red-ball'
export function phraseText(t: Thing): string;    // 'a red ball' or 'Touch the small red ball'
export function buildScene(difficulty: 'medium' | 'hard', rng: Rng): { target: Thing; options: Thing[] };
export function allPhrases(): { id: string; text: string }[];   // 72 + 144 = 216
export const ROUND_SIZE = 10;
```

**Rules:**
- Easy: a single word from the word bank is spoken; 3 pictures via `buildOptions(target, pool, { pictures: 3, sameCategory: 0, preferSameFirstLetter: false }, rng)`. Progress is recorded.
- Medium: phrase `a {colour} {noun}`, 4 options, no `size`. Hard: `Touch the {size} {colour} {noun}`, 6 options.
- Every distractor differs from the target in exactly one attribute; all options are distinct; each attribute in play is varied by at least one distractor.
- Shapes are 12 hand-made single-path SVGs using `fill="currentColor"`; colour and scale are applied in CSS. Record them in `ASSETS.md` as original.
- No text on screen during an item. A large speaker button replays at rate 1; a turtle button replays at rate 0.6. Both are free and unlimited.
- The item's audio plays once automatically when its pictures appear.
- Wrong tap: the picture fades out, the audio replays at 0.6. Second wrong tap: the correct picture glows and the child taps it to continue. A missed item is re-queued once at the end of the round (`requeueCurrent`).
- Stars: `starsFromRatio(firstTryCount, 10)`.

- [ ] **Step 1:** Write failing tests:

```ts
test('phrase ids and texts', () => {
  expect(phraseId({ noun: 'ball', colour: 'red' })).toBe('p2-red-ball');
  expect(phraseText({ noun: 'ball', colour: 'red' })).toBe('a red ball');
  expect(phraseId({ noun: 'ball', colour: 'red', size: 'small' })).toBe('p3-small-red-ball');
  expect(phraseText({ noun: 'ball', colour: 'red', size: 'small' })).toBe('Touch the small red ball');
});
test('allPhrases has 216 unique ids', () => {});
test.each([['medium', 4], ['hard', 6]])('%s scene: %i distinct options incl. target, each distractor differs in exactly one attribute', (d, n) => { /* run 200 seeds */ });
test('hard scene varies noun, colour and size across its distractors', () => {});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `scene.ts`, draw the shapes, implement `screen.ts`, add phrases to the manifest script.
- [ ] **Step 4:** Run tests; expect PASS. `npm run audio:manifest` now lists words plus 216 phrases. Play each difficulty by hand (speech fallback is expected until mp3 files exist).
- [ ] **Step 5:** Commit: `feat: listen and catch game`.

### Task 11: Letter Balloons

**Files:** Create `src/games/letter-balloons/logic.ts`, `src/games/letter-balloons/screen.ts`, `src/styles/letter-balloons.css`, `tests/games/letter-balloons.test.ts`

**Interfaces**
- Consumes: `Word`, `Rng`, `pickRoundWords`, `starsFromRatio`, `finishRound`, `AudioPlayer`.
- Produces:

```ts
export interface LBConfig { minLen: number; maxLen: number; distractors: [number, number]; confusable: boolean;
  firstLetterGiven: boolean; uppercase: boolean; autoAudio: boolean; speed: number /* px per second */ }
export const LB_CONFIG: Record<Difficulty, LBConfig>;
// easy:   { minLen: 3, maxLen: 4, distractors: [0, 0], confusable: false, firstLetterGiven: true,  uppercase: true,  autoAudio: true,  speed: 40 }
// medium: { minLen: 4, maxLen: 6, distractors: [2, 3], confusable: false, firstLetterGiven: false, uppercase: false, autoAudio: true,  speed: 55 }
// hard:   { minLen: 5, maxLen: 8, distractors: [3, 4], confusable: true,  firstLetterGiven: false, uppercase: false, autoAudio: false, speed: 55 }
export const CONFUSABLE: Record<string, string[]>;
// b:[d,p] d:[b,p] p:[b,q,d] q:[p] i:[e] e:[i,a] a:[e,u] u:[a] c:[k] k:[c] m:[n] n:[m] v:[w] w:[v] s:[z] z:[s]
export const ROUND_SIZE = 6;
export function candidatesForLength(words: readonly Word[], cfg: LBConfig): Word[];   // widens the range by 1 each side until >= 6 words
export function distractorLetters(word: string, cfg: LBConfig, rng: Rng): string[];   // never a letter of the word
export class WordAttempt {
  constructor(word: string, cfg: LBConfig);
  filled(): string;                     // letters placed so far
  nextLetter(): string | null;
  pop(letter: string): 'correct' | 'wrong' | 'ignored';   // 'ignored' once done
  useHint(): void;
  shouldGlow(): boolean;                // hint used on this letter, or 2 wrong pops on it
  done(): boolean;
  clean(): boolean;                     // no hint and at most 1 wrong pop in the whole word
}
export class BalloonRound {
  constructor(words: readonly string[]);          // 6 words
  current(): string | null;                       // null when finished
  complete(clean: boolean): void;                 // not-clean words are retried once after the 6th
  isRetry(): boolean;
  cleanCount(): number;                           // a clean retry counts as clean
  items(): RoundItem[];                           // firstTry = clean on the first attempt
}
export function nextSpawn(needed: string | null, onScreen: readonly string[], queue: readonly string[]): string | null;
// returns `needed` when it is not on screen, otherwise the next queued letter
```

**Rules:**
- Round: 6 words from `pickRoundWords` over `candidatesForLength(wordsUpToLevel(level), cfg)`.
- One balloon per needed letter copy (APPLE has two P balloons); any balloon with the needed letter is accepted.
- At most 7 balloons on screen below 480 px width, 10 otherwise. Balloons are at least 72 px wide with a hit area 20% larger and do not overlap.
- A balloon leaving the top re-enters from the bottom within 2 seconds. The next needed letter is always on screen or the next to spawn (`nextSpawn`).
- Wrong pop: the balloon wobbles and bounces aside; it does not pop. No sound.
- Bulb button: the next correct balloon glows; the word is no longer clean. Speaker button: replays the word, free.
- Easy shows slots with the first letter filled; medium and hard show empty slots.
- Word complete: the word is spoken, the Hebrew translation shows for 1.5 seconds, then the next word.
- After the 6th word, each not-clean word is played once more.
- Stars: `starsFromRatio(cleanCount, 6)`. `progress.record(wordId, firstTry)` uses the first attempt only.

- [ ] **Step 1:** Write failing tests:

```ts
test('pop: correct letters fill in order; wrong letter does not advance', () => {
  const a = new WordAttempt('cat', LB_CONFIG.medium);
  expect(a.pop('a')).toBe('wrong'); expect(a.pop('c')).toBe('correct'); expect(a.filled()).toBe('c');
});
test('easy starts with the first letter filled', () => { expect(new WordAttempt('cat', LB_CONFIG.easy).filled()).toBe('c'); });
test('double letters need two pops', () => { /* 'apple': a,p,p,l,e -> done */ });
test('clean: one wrong pop is still clean, two are not, a hint is not', () => {});
test('shouldGlow after two wrong pops on the same letter, reset on the next letter', () => {});
test('pop after done is ignored', () => {});
test('distractorLetters: count within range, none in the word, confusable ones on hard', () => { /* 200 seeds */ });
test('candidatesForLength widens until 6 words', () => {});
test('BalloonRound retries only not-clean words, once, and a clean retry raises cleanCount', () => {});
test('nextSpawn returns the needed letter when it is off screen', () => {
  expect(nextSpawn('p', ['a', 'l'], ['e', 'k'])).toBe('p');
  expect(nextSpawn('p', ['p', 'l'], ['e', 'k'])).toBe('e');
});
```

- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `logic.ts`, then `screen.ts` (balloons are buttons moved by `requestAnimationFrame`; stop the loop in `unmount`).
- [ ] **Step 4:** Run tests; expect PASS. Play each difficulty by hand on a 360 px wide viewport and on desktop.
- [ ] **Step 5:** Commit: `feat: letter balloons game`.

### Task 12: Device check and hand-over

**Files:** Create `README.md`; Modify styles as needed

- [ ] **Step 1:** Run `npm test`, `npm run typecheck`, `npm run build`; all pass.
- [ ] **Step 2:** Play one full round of each game at each difficulty in Chrome desktop, on an Android phone and on an iPhone or iPad (Safari). Check: audio starts after "התחל", nothing overflows at 360 px, rotation keeps the game playable, reload keeps profile, stars and progress.
- [ ] **Step 3:** Fix what the check finds; add a test for any logic bug.
- [ ] **Step 4:** Write `README.md`: how to run, test, build; how to produce audio files from `audio-manifest.json` into `public/audio/`; the `VITE_MATH_GAME_URL` option; what Step 2 will replace (`LocalStorageService`).
- [ ] **Step 5:** Commit: `docs: readme and device fixes`.

## Open items for the owner (not blocking the build)

- Which tool produces the mp3 files from `audio-manifest.json`. Until then the game speaks through the browser fallback.
- Capital or small letters in Letter Balloons: currently capitals on easy, small letters on medium and hard (`LBConfig.uppercase`).
- Whether to set `VITE_MATH_GAME_URL` now.
