import { expect, test } from 'vitest';
import { resolveAssetUrl } from '../../src/app/dom';

// The published site is built with a relative base and lives in a sub-folder.
// A relative address handed to CSS is looked up next to the stylesheet (in
// assets/), not next to the page, so every asset address must be a full URL.
test('an asset on the published site resolves next to the page, as a full URL', () => {
  expect(resolveAssetUrl('img/shapes/ball.svg', './', 'https://assaf43.github.io/learn-english-game/'))
    .toBe('https://assaf43.github.io/learn-english-game/img/shapes/ball.svg');
});

test('the page address may name a file or carry a query', () => {
  expect(resolveAssetUrl('img/words/cat.svg', './', 'https://example.org/games/index.html?x=1#top'))
    .toBe('https://example.org/games/img/words/cat.svg');
});

test('an absolute base is kept', () => {
  expect(resolveAssetUrl('img/words/cat.svg', '/', 'http://localhost:5173/')).toBe('http://localhost:5173/img/words/cat.svg');
  expect(resolveAssetUrl('img/words/cat.svg', '/games/', 'https://example.org/somewhere/else'))
    .toBe('https://example.org/games/img/words/cat.svg');
});

test('a base without a closing slash still gets one', () => {
  expect(resolveAssetUrl('fonts/a.woff2', '/games', 'https://example.org/')).toBe('https://example.org/games/fonts/a.woff2');
});
