import type { AudioPlayer } from '../core/audio';
import type { ProfileStore } from '../core/profiles';
import type { Rng } from '../core/rng';
import type { StorageService } from '../core/storage';
import type { Route } from './router';

/** Everything a screen needs from the app. */
export interface AppContext {
  storage: StorageService;
  profiles: ProfileStore;
  audio: AudioPlayer;
  rng: Rng;
  navigate(route: Route): void;
}

/** One full-page view. `unmount` must stop the timers and animation loops the screen started. */
export interface Screen {
  mount(root: HTMLElement): void | Promise<void>;
  unmount(): void;
}
