import './styles/base.css';
import './styles/game.css';
import './styles/word-object.css';
import './styles/listen-catch.css';
import './styles/letter-balloons.css';
import type { AppContext, Screen } from './app/context';
import { createRouter, type Route } from './app/router';
import { FileAudioPlayer } from './core/audio';
import { ProfileStore } from './core/profiles';
import { mulberry32 } from './core/rng';
import { LocalStorageService } from './core/storage';
import type { GameId } from './core/types';
import { letterBalloonsScreen } from './games/letter-balloons/screen';
import { listenCatchScreen } from './games/listen-catch/screen';
import { wordObjectScreen } from './games/word-object/screen';
import { homeScreen } from './screens/home';
import { summaryScreen } from './screens/summary';
import { whoScreen } from './screens/who';

const GAME_SCREENS: Record<GameId, (ctx: AppContext) => Screen> = {
  'letter-balloons': letterBalloonsScreen,
  'listen-catch': listenCatchScreen,
  'word-object': wordObjectScreen,
};

function screenFor(route: Route, ctx: AppContext): Screen {
  switch (route.name) {
    case 'who':
      return whoScreen(ctx);
    case 'home':
      return homeScreen(ctx);
    case 'game':
      return GAME_SCREENS[route.game](ctx);
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
