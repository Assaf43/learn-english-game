import type { Difficulty, GameId, Grade, RoundResult } from '../core/types';
import type { AppContext, Screen } from './context';

export type Route =
  | { name: 'who' }
  | { name: 'home' }
  | { name: 'game'; game: GameId }
  | { name: 'summary'; result: RoundResult };

/**
 * Shows one screen at a time inside `root`. Navigating always unmounts the
 * previous screen first, even when that screen fails while unmounting.
 */
export function createRouter(
  root: HTMLElement,
  screens: (route: Route, ctx: AppContext) => Screen,
  ctx: AppContext,
): { navigate(route: Route): void } {
  let current: Screen | null = null;

  return {
    navigate(route: Route): void {
      if (current) {
        try {
          current.unmount();
        } catch (error) {
          console.error('Screen failed to unmount', error);
        }
      }
      root.replaceChildren();
      current = screens(route, ctx);
      try {
        const mounted = current.mount(root);
        if (mounted instanceof Promise) mounted.catch(error => console.error('Screen failed to mount', error));
      } catch (error) {
        console.error('Screen failed to mount', error);
      }
    },
  };
}

/** The difficulty a game starts with before the player has chosen one. */
export function defaultDifficulty(grade: Grade): Difficulty {
  return grade <= 4 ? 'easy' : 'medium';
}
