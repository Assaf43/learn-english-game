import './styles/base.css';
import './styles/game.css';
import './styles/word-object.css';
import type { AppContext, Screen } from './app/context';
import { COPY } from './app/copy';
import { el } from './app/dom';
import { createRouter, type Route } from './app/router';
import { FileAudioPlayer } from './core/audio';
import { ProfileStore } from './core/profiles';
import { mulberry32 } from './core/rng';
import { LocalStorageService } from './core/storage';
import type { GameId } from './core/types';
import { wordObjectScreen } from './games/word-object/screen';
import { homeScreen } from './screens/home';
import { summaryScreen } from './screens/summary';
import { whoScreen } from './screens/who';

/** Stands in for a game that is not built yet: its name and the way back. */
function gameNotReadyScreen(ctx: AppContext, game: GameId): Screen {
  return {
    mount(root: HTMLElement): void {
      const back = el('button', { class: 'btn btn-primary', type: 'button' }, COPY.backHome);
      back.addEventListener('click', () => ctx.navigate({ name: 'home' }));
      root.replaceChildren(
        el('section', { class: 'summary' },
          el('h1', { class: 'page-title' }, COPY.games[game]),
          el('div', { class: 'actions' }, back),
        ),
      );
    },
    unmount(): void {},
  };
}

function screenFor(route: Route, ctx: AppContext): Screen {
  switch (route.name) {
    case 'who':
      return whoScreen(ctx);
    case 'home':
      return homeScreen(ctx);
    case 'game':
      return route.game === 'word-object' ? wordObjectScreen(ctx) : gameNotReadyScreen(ctx, route.game);
    case 'summary':
      return summaryScreen(ctx, route.result);
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  const storage = new LocalStorageService();
  const ctx: AppContext = {
    storage,
    profiles: new ProfileStore(storage),
    audio: new FileAudioPlayer(),
    rng: mulberry32(Date.now()),
    navigate: () => {},
  };
  const router = createRouter(root, screenFor, ctx);
  ctx.navigate = route => router.navigate(route);

  void ctx.profiles.current().then(profile => ctx.navigate({ name: profile ? 'home' : 'who' }));
}
