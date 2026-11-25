import type { AppContext, Screen } from '../app/context';
import { COPY } from '../app/copy';
import { assetUrl, avatarUrl, el } from '../app/dom';
import { ProgressStore } from '../core/progress';
import { StarStore } from '../core/stars';
import type { GameId } from '../core/types';

/** Order and picture of the game cards. The pictures are word pictures already in the project. */
const GAME_CARDS: readonly { game: GameId; picture: string }[] = [
  { game: 'letter-balloons', picture: 'img/words/balloon.svg' },
  { game: 'listen-catch', picture: 'img/words/ear.svg' },
  { game: 'word-object', picture: 'img/words/apple.svg' },
];

/** A wavy sea surface from x = -1200 to x = 2000, closed along the bottom of the scene. */
function waves(y: number): string {
  let path = `M-1200 ${y} Q-1100 ${y - 28} -1000 ${y}`;
  for (let x = -800; x <= 2000; x += 200) path += ` T${x} ${y}`;
  return `${path} V320 H-1200Z`;
}

/**
 * A still island scene behind the games area. Original artwork for this project.
 * The drawing is much wider than any screen, so its height sets the scale and
 * the sea always reaches both edges.
 */
const ISLAND = `
<svg viewBox="-1200 0 3200 320" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <circle cx="252" cy="62" r="34" fill="#FFC83D" stroke="#17324D" stroke-width="5"/>
  <path d="${waves(210)}" fill="#1BA8B8" stroke="#17324D" stroke-width="5"/>
  <path d="M170 250 Q400 60 630 250 Z" fill="#FFE7AE" stroke="#17324D" stroke-width="5" stroke-linejoin="round"/>
  <path d="M392 170 Q380 110 402 70" fill="none" stroke="#17324D" stroke-width="16" stroke-linecap="round"/>
  <path d="M392 170 Q380 110 402 70" fill="none" stroke="#B9783F" stroke-width="8" stroke-linecap="round"/>
  <g fill="#3CBF7C" stroke="#17324D" stroke-width="5" stroke-linejoin="round">
    <path d="M402 70 Q350 30 300 62 Q352 60 402 70Z"/>
    <path d="M402 70 Q455 28 506 60 Q452 60 402 70Z"/>
    <path d="M402 70 Q372 10 322 14 Q372 34 402 70Z"/>
    <path d="M402 70 Q434 8 484 14 Q434 34 402 70Z"/>
  </g>
  <path d="${waves(262)}" fill="#45C4D1" stroke="#17324D" stroke-width="5"/>
</svg>`;

function mathGameUrl(): string | null {
  const value: unknown = import.meta.env.VITE_MATH_GAME_URL;
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The games area: the player's header and one card per game. */
export function homeScreen(ctx: AppContext): Screen {
  let mounted = false;

  return {
    async mount(root: HTMLElement): Promise<void> {
      mounted = true;
      const profile = await ctx.profiles.current();
      if (!mounted) return;
      if (!profile) {
        ctx.navigate({ name: 'who' });
        return;
      }

      const progress = new ProgressStore(ctx.storage, profile.id);
      const [stars] = await Promise.all([new StarStore(ctx.storage, profile.id).totals(), progress.load()]);
      if (!mounted) return;

      const avatar = el('button', { class: 'avatar-btn', type: 'button', 'aria-label': COPY.whoTitle },
        el('img', { src: avatarUrl(profile.avatar), alt: '' }),
      );
      avatar.addEventListener('click', () => ctx.navigate({ name: 'who' }));

      const header = el('header', { class: 'topbar' },
        avatar,
        el('div', { class: 'player' },
          el('strong', { class: 'player-name' }, profile.name),
          el('span', { class: 'player-grade' }, `${COPY.grade} ${COPY.grades[profile.grade]}`),
        ),
        // Reserved for the Step 2 coupons button.
        el('div', { class: 'coupon-slot', 'data-slot': 'coupons' }),
        el('div', { class: 'stat stat-stars' },
          el('span', { class: 'star', 'aria-hidden': 'true' }, '★'),
          el('span', { class: 'stat-num' }, String(stars.total)),
        ),
        el('div', { class: 'stat' },
          el('span', { class: 'stat-label' }, COPY.knownWords),
          el('span', { class: 'stat-num' }, String(progress.knownCount())),
        ),
      );

      const gameCards = GAME_CARDS.map(({ game, picture }) => {
        const card = el('button', { class: `card card-${game}`, type: 'button' },
          el('img', { class: 'card-picture', src: assetUrl(picture), alt: '' }),
          el('span', { class: 'card-title' }, COPY.games[game]),
          el('span', { class: 'card-stars' },
            el('span', { class: 'star', 'aria-hidden': 'true' }, '★'),
            String(stars.byGame[game]),
          ),
        );
        card.addEventListener('click', () => ctx.navigate({ name: 'game', game }));
        return card;
      });

      const areas = el('main', { class: 'areas' },
        el('section', { class: 'area' },
          el('h2', { class: 'area-title' }, COPY.areaEnglish),
          el('div', { class: 'cards' }, ...gameCards),
        ),
      );

      const mathUrl = mathGameUrl();
      if (mathUrl) {
        areas.append(
          el('section', { class: 'area' },
            el('h2', { class: 'area-title' }, COPY.areaMath),
            el('div', { class: 'cards' },
              el('a', { class: 'card card-math', href: mathUrl },
                el('span', { class: 'card-symbols', 'aria-hidden': 'true', dir: 'ltr' }, '1+2'),
                el('span', { class: 'card-title' }, COPY.areaMath),
              ),
            ),
          ),
        );
      }

      const scene = el('div', { class: 'scene' });
      scene.innerHTML = ISLAND;

      root.replaceChildren(el('div', { class: 'home' }, scene, header, areas));
    },
    unmount(): void {
      mounted = false;
    },
  };
}
