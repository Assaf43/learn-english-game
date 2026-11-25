import type { AppContext, Screen } from '../app/context';
import { COPY } from '../app/copy';
import { assetUrl, el } from '../app/dom';
import type { ProgressStore } from '../core/progress';
import { StarStore } from '../core/stars';
import type { RoundResult, Word } from '../core/types';
import { wordById } from '../core/wordbank';

/**
 * Ends a round: saves the player's word progress, adds the round's stars,
 * then shows the summary screen.
 */
export async function finishRound(ctx: AppContext, profileId: string, result: RoundResult, progress: ProgressStore): Promise<void> {
  await progress.finishRound();
  await new StarStore(ctx.storage, profileId).add(result.game, result.stars);
  ctx.navigate({ name: 'summary', result });
}

/** End of a round: the stars earned and the words to practise. */
export function summaryScreen(ctx: AppContext, result: RoundResult): Screen {
  return {
    mount(root: HTMLElement): void {
      const stars = el('div', { class: 'summary-stars', role: 'img', 'aria-label': `${result.stars} / 3` },
        ...[1, 2, 3].map(n => el('span', { class: n <= result.stars ? 'big-star' : 'big-star big-star-empty' }, '★')),
      );

      // Items that are not in the word bank (Listen and Catch phrases) have nothing to show here.
      const toPractise = result.items
        .filter(item => !item.firstTry)
        .map(item => wordById(item.wordId))
        .filter((word): word is Word => word !== undefined);

      const again = el('button', { class: 'btn btn-primary', type: 'button' }, COPY.playAgain);
      again.addEventListener('click', () => ctx.navigate({ name: 'game', game: result.game }));
      const home = el('button', { class: 'btn', type: 'button' }, COPY.backHome);
      home.addEventListener('click', () => ctx.navigate({ name: 'home' }));

      const section = el('section', { class: 'summary' },
        el('h1', { class: 'page-title' }, COPY.summaryTitle),
        stars,
      );

      if (toPractise.length > 0) {
        const words = toPractise.map(word => {
          const button = el('button', { class: 'practise-word', type: 'button' },
            el('img', { src: assetUrl(word.image), alt: '' }),
            el('span', { class: 'en', dir: 'ltr', lang: 'en' }, word.en),
            el('span', { class: 'he' }, word.he),
          );
          button.addEventListener('click', () => {
            ctx.audio.unlock();
            void ctx.audio.play(word.id, word.en);
          });
          return el('li', {}, button);
        });
        section.append(
          el('h2', { class: 'area-title' }, COPY.practiseWords),
          el('ul', { class: 'practise' }, ...words),
        );
      }

      section.append(el('div', { class: 'actions' }, again, home));
      root.replaceChildren(section);
    },
    unmount(): void {},
  };
}
