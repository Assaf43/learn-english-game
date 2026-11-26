type Child = Node | string | null | undefined | false;

/** Builds an element. `class` sets the class name; `true` sets an empty attribute; `false` and `undefined` are skipped. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') node.className = String(value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/**
 * The full URL of `path` under the app's base, worked out from the page address.
 * The published site is built with a relative base (`./`). A relative address
 * given to CSS (a mask image, a custom property) is looked up next to the
 * stylesheet in `assets/`, not next to the page, so asset addresses are always
 * made absolute here.
 */
export function resolveAssetUrl(path: string, base: string, pageUrl: string): string {
  return new URL(`${base.endsWith('/') ? base : `${base}/`}${path}`, pageUrl).href;
}

/** The URL of a file in `public/`, for example `assetUrl('img/words/cat.svg')`. Always a full URL. */
export function assetUrl(path: string): string {
  return resolveAssetUrl(path, import.meta.env.BASE_URL ?? '/', document.baseURI);
}

/** Avatar ids a player can choose from; each has a picture in `public/img/avatars/`. */
export const AVATARS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/** The picture for an avatar id. An unknown id shows the first avatar. */
export function avatarUrl(avatar: string): string {
  return assetUrl(`img/avatars/${AVATARS.includes(avatar) ? avatar : AVATARS[0]}.svg`);
}

/** Starts loading pictures before they are shown, so they do not pop in a moment after their tile. */
export function preloadImages(urls: Iterable<string>): void {
  for (const url of new Set(urls)) {
    const image = new Image();
    image.src = url;
  }
}
