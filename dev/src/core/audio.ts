export interface AudioPlayer {
  /** Call inside a user tap, before the first sound. */
  unlock(): void;
  /** Plays the sound with this id. Resolves when it has finished; never rejects. */
  play(id: string, text: string, opts?: { rate?: number }): Promise<void>;
}

/** `play` resolves after this long even if the sound never reports its end. */
const MAX_WAIT_MS = 6000;

/** A short silent WAV, played inside the first tap so later sounds are allowed to start. */
function silentSound(): string {
  const samples = 400;
  const bytes = new Uint8Array(44 + samples).fill(0x80);
  const header = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  header.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, 8000, true); // sample rate
  header.setUint32(28, 8000, true); // byte rate
  header.setUint16(32, 1, true);
  header.setUint16(34, 8, true); // bits per sample
  ascii(36, 'data');
  header.setUint32(40, samples, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

function defaultSpeech(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

function utterance(text: string): SpeechSynthesisUtterance {
  return typeof SpeechSynthesisUtterance === 'function'
    ? new SpeechSynthesisUtterance(text)
    : ({ text } as SpeechSynthesisUtterance);
}

/**
 * Plays `audio/<id>.mp3`. When the file is missing or cannot play, speaks the
 * text with the browser's speech synthesis; when that is unavailable too, stays silent.
 *
 * One audio element is reused for every sound: mobile browsers only let an
 * element play without a tap after it was first started inside one (`unlock`).
 */
export class FileAudioPlayer implements AudioPlayer {
  private readonly createAudio: (src: string) => HTMLAudioElement;
  private readonly speech: SpeechSynthesis | null;
  private readonly baseUrl: string;
  private element: HTMLAudioElement | null = null;
  private unlocked = false;
  /** Goes up with every `play`, so a stopped sound can tell it is no longer current. */
  private generation = 0;
  private finishCurrent: (() => void) | null = null;
  /** The speech fallback is talking right now. */
  private speaking = false;

  constructor(deps: { createAudio?: (src: string) => HTMLAudioElement; speech?: SpeechSynthesis | null; baseUrl?: string } = {}) {
    this.createAudio = deps.createAudio ?? (src => new Audio(src));
    this.speech = deps.speech === undefined ? defaultSpeech() : deps.speech;
    const base = deps.baseUrl ?? import.meta.env.BASE_URL ?? '/';
    this.baseUrl = base.endsWith('/') ? base : `${base}/`;
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      void this.elementFor(silentSound()).play()?.catch(() => {});
    } catch {
      // No audio support: sounds will use the speech fallback.
    }
    try {
      if (this.speech) {
        const silent = utterance(' ');
        silent.volume = 0;
        this.speech.speak(silent);
      }
    } catch {
      // No speech support.
    }
  }

  play(id: string, text: string, opts: { rate?: number } = {}): Promise<void> {
    this.stop();
    const generation = ++this.generation;
    const rate = opts.rate ?? 1;

    return new Promise<void>(resolve => {
      let settled = false;
      let spoke = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.finishCurrent === finish) this.finishCurrent = null;
        resolve();
      };
      const timer = setTimeout(finish, MAX_WAIT_MS);
      this.finishCurrent = finish;

      const fallBackToSpeech = (): void => {
        if (settled || spoke || generation !== this.generation) return;
        spoke = true;
        this.speak(text, rate, finish);
      };

      try {
        const el = this.elementFor(`${this.baseUrl}audio/${id}.mp3`);
        el.defaultPlaybackRate = rate;
        el.playbackRate = rate;
        el.preservesPitch = true;
        el.onended = finish;
        el.onerror = fallBackToSpeech;
        el.play()?.catch(fallBackToSpeech);
      } catch {
        fallBackToSpeech();
      }
    });
  }

  /** Stops the sound that is playing and resolves its `play` promise. */
  private stop(): void {
    try {
      if (this.element) {
        this.element.onended = null;
        this.element.onerror = null;
        this.element.pause();
      }
    } catch {
      // Nothing was playing.
    }
    // Speech is cancelled only when the fallback is talking. Cancelling at other
    // times would throw away the silent utterance that `unlock` uses on phones.
    if (this.speaking) {
      this.speaking = false;
      try {
        this.speech?.cancel();
      } catch {
        // No speech support.
      }
    }
    this.finishCurrent?.();
  }

  private elementFor(src: string): HTMLAudioElement {
    if (this.element) this.element.src = src;
    else this.element = this.createAudio(src);
    return this.element;
  }

  private speak(text: string, rate: number, done: () => void): void {
    if (!this.speech) {
      done();
      return;
    }
    const finished = (): void => {
      this.speaking = false;
      done();
    };
    try {
      const u = utterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      u.onend = finished;
      u.onerror = finished;
      this.speaking = true;
      this.speech.speak(u);
    } catch {
      finished();
    }
  }
}

/** Plays nothing. For tests. */
export class SilentAudioPlayer implements AudioPlayer {
  readonly played: { id: string; text: string; rate: number }[] = [];

  unlock(): void {}

  async play(id: string, text: string, opts: { rate?: number } = {}): Promise<void> {
    this.played.push({ id, text, rate: opts.rate ?? 1 });
  }
}
