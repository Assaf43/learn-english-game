import { afterEach, expect, test, vi } from 'vitest';
import { FileAudioPlayer, SilentAudioPlayer } from '../../src/core/audio';

type Mode = 'ends' | 'never-ends' | 'errors' | 'rejects';

/** Stands in for an HTMLAudioElement. */
class FakeAudio {
  src: string;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preservesPitch = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;
  private readonly mode: Mode;

  constructor(src: string, mode: Mode) {
    this.src = src;
    this.mode = mode;
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.mode === 'rejects') return Promise.reject(new Error('NotAllowedError'));
    if (this.mode === 'errors') queueMicrotask(() => this.onerror?.());
    if (this.mode === 'ends') queueMicrotask(() => this.onended?.());
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
  }
}

function audioFactory(mode: Mode) {
  const made: FakeAudio[] = [];
  const createAudio = (src: string) => {
    const el = new FakeAudio(src, mode);
    made.push(el);
    return el as unknown as HTMLAudioElement;
  };
  return { made, createAudio };
}

interface Spoken { text: string; lang: string; rate: number; onend: (() => void) | null; onerror: (() => void) | null }

function fakeSpeech(finishes = true) {
  const spoken: Spoken[] = [];
  let cancels = 0;
  const speech = {
    speak(u: Spoken) {
      spoken.push(u);
      if (finishes) queueMicrotask(() => u.onend?.());
    },
    cancel() { cancels += 1; },
  } as unknown as SpeechSynthesis;
  return { spoken, speech, cancels: () => cancels };
}

const failingAudio = audioFactory('errors').createAudio;

afterEach(() => {
  vi.useRealTimers();
});

test('plays the file at the requested rate', async () => {
  const { made, createAudio } = audioFactory('ends');
  const player = new FileAudioPlayer({ createAudio, speech: null, baseUrl: '/' });
  await player.play('hammer', 'hammer', { rate: 0.6 });
  expect(made).toHaveLength(1);
  expect(made[0].src).toBe('/audio/hammer.mp3');
  expect(made[0].playbackRate).toBe(0.6);
  expect(made[0].preservesPitch).toBe(true);
  expect(made[0].playCalls).toBe(1);
});

test('plays at rate 1 when no rate is given, under the base url', async () => {
  const { made, createAudio } = audioFactory('ends');
  const player = new FileAudioPlayer({ createAudio, speech: null, baseUrl: '/games/' });
  await player.play('cat', 'cat');
  expect(made[0].src).toBe('/games/audio/cat.mp3');
  expect(made[0].playbackRate).toBe(1);
});

test('falls back to speech when the file errors', async () => {
  const { spoken, speech } = fakeSpeech();
  const player = new FileAudioPlayer({ createAudio: failingAudio, speech, baseUrl: '/' });
  await player.play('hammer', 'hammer', { rate: 0.6 });
  expect(spoken).toHaveLength(1);
  expect(spoken[0].text).toBe('hammer');
  expect(spoken[0].lang).toBe('en-US');
  expect(spoken[0].rate).toBe(0.6);
});

test('falls back to speech when play() rejects', async () => {
  const { spoken, speech } = fakeSpeech();
  const player = new FileAudioPlayer({ createAudio: audioFactory('rejects').createAudio, speech, baseUrl: '/' });
  await player.play('p2-red-ball', 'a red ball');
  expect(spoken.map(u => u.text)).toEqual(['a red ball']);
});

test('falls back to speech when the audio element cannot be created', async () => {
  const { spoken, speech } = fakeSpeech();
  const createAudio = (): HTMLAudioElement => { throw new Error('no audio support'); };
  await new FileAudioPlayer({ createAudio, speech, baseUrl: '/' }).play('cat', 'cat');
  expect(spoken.map(u => u.text)).toEqual(['cat']);
});

test('resolves silently when file fails and speech is null', async () => {
  await expect(new FileAudioPlayer({ createAudio: failingAudio, speech: null }).play('x', 'x')).resolves.toBeUndefined();
});

test('resolves when speech itself throws', async () => {
  const speech = { speak() { throw new Error('speech broken'); }, cancel() {} } as unknown as SpeechSynthesis;
  await expect(new FileAudioPlayer({ createAudio: failingAudio, speech }).play('x', 'x')).resolves.toBeUndefined();
});

test('a second play stops the first', async () => {
  const { made, createAudio } = audioFactory('never-ends');
  const player = new FileAudioPlayer({ createAudio, speech: null, baseUrl: '/' });
  let firstDone = false;
  const first = player.play('cat', 'cat').then(() => { firstDone = true; });
  await Promise.resolve();
  expect(firstDone).toBe(false);

  void player.play('dog', 'dog');
  await first;
  expect(firstDone).toBe(true);
  expect(made[0].pauseCalls).toBeGreaterThanOrEqual(1);
  expect(made[made.length - 1].src).toBe('/audio/dog.mp3');
});

test('a sound that was stopped does not start the speech fallback later', async () => {
  let rejectFirst: (e: Error) => void = () => {};
  const { spoken, speech } = fakeSpeech();
  const el = {
    src: '', playbackRate: 1, defaultPlaybackRate: 1, preservesPitch: false, onended: null, onerror: null,
    calls: 0,
    play() {
      this.calls += 1;
      if (this.calls === 1) return new Promise<void>((_, reject) => { rejectFirst = reject; });
      return Promise.resolve();
    },
    pause() {},
  };
  const player = new FileAudioPlayer({ createAudio: (src) => { el.src = src; return el as unknown as HTMLAudioElement; }, speech, baseUrl: '/' });
  const first = player.play('cat', 'cat');
  void player.play('dog', 'dog');
  rejectFirst(new Error('AbortError: interrupted by a new load request'));
  await first;
  await Promise.resolve();
  expect(spoken).toEqual([]);
});

test('resolves within 6 seconds even if no end event arrives', async () => {
  vi.useFakeTimers();
  const player = new FileAudioPlayer({ createAudio: audioFactory('never-ends').createAudio, speech: null, baseUrl: '/' });
  let done = false;
  void player.play('cat', 'cat').then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(5900);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(200);
  expect(done).toBe(true);
});

test('resolves within 6 seconds when speech never reports its end', async () => {
  vi.useFakeTimers();
  const { speech } = fakeSpeech(false);
  const player = new FileAudioPlayer({ createAudio: failingAudio, speech, baseUrl: '/' });
  let done = false;
  void player.play('cat', 'cat').then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(6100);
  expect(done).toBe(true);
});

test('unlock starts one silent sound and never throws', async () => {
  const { made, createAudio } = audioFactory('ends');
  const player = new FileAudioPlayer({ createAudio, speech: null, baseUrl: '/' });
  player.unlock();
  player.unlock();
  expect(made).toHaveLength(1);
  expect(made[0].playCalls).toBe(1);
  expect(made[0].src.startsWith('data:audio/')).toBe(true);

  const broken = new FileAudioPlayer({ createAudio: () => { throw new Error('no audio'); }, speech: null });
  expect(() => broken.unlock()).not.toThrow();
});

test('sounds after unlock reuse the unlocked element', async () => {
  const { made, createAudio } = audioFactory('ends');
  const player = new FileAudioPlayer({ createAudio, speech: null, baseUrl: '/' });
  player.unlock();
  await player.play('cat', 'cat');
  await player.play('dog', 'dog');
  expect(made).toHaveLength(1);
  expect(made[0].src).toBe('/audio/dog.mp3');
  expect(made[0].playCalls).toBe(3);
});

test('SilentAudioPlayer resolves at once and remembers what was asked', async () => {
  const player = new SilentAudioPlayer();
  player.unlock();
  await player.play('cat', 'cat', { rate: 0.6 });
  await player.play('dog', 'dog');
  expect(player.played).toEqual([{ id: 'cat', text: 'cat', rate: 0.6 }, { id: 'dog', text: 'dog', rate: 1 }]);
});

test('starting a sound leaves speech alone unless the fallback is speaking', async () => {
  const quiet = fakeSpeech(false);
  const working = new FileAudioPlayer({ createAudio: audioFactory('ends').createAudio, speech: quiet.speech, baseUrl: '/' });
  working.unlock();
  await working.play('cat', 'cat');
  await working.play('dog', 'dog');
  // Cancelling here would throw away the silent utterance that unlocks speech on phones.
  expect(quiet.cancels()).toBe(0);

  const talking = fakeSpeech(false);
  const failing = new FileAudioPlayer({ createAudio: audioFactory('errors').createAudio, speech: talking.speech, baseUrl: '/' });
  void failing.play('cat', 'cat');
  await Promise.resolve();
  await Promise.resolve();
  expect(talking.spoken.map(u => u.text)).toEqual(['cat']);
  void failing.play('dog', 'dog');
  expect(talking.cancels()).toBe(1);
});
