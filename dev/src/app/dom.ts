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

/** The URL of a file in `public/`, for example `assetUrl('img/words/cat.svg')`. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
}

/** Avatar ids a player can choose from; each has a picture in `public/img/avatars/`. */
export const AVATARS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/** The picture for an avatar id. An unknown id shows the first avatar. */
export function avatarUrl(avatar: string): string {
  return assetUrl(`img/avatars/${AVATARS.includes(avatar) ? avatar : AVATARS[0]}.svg`);
}
