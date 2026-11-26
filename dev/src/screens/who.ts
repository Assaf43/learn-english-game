import type { AppContext, Screen } from '../app/context';
import { COPY } from '../app/copy';
import { AVATARS, avatarUrl, el } from '../app/dom';
import { InvalidProfileError } from '../core/profiles';
import type { Grade, Profile } from '../core/types';

const GRADES: readonly Grade[] = [3, 4, 5, 6];
const MAX_NAME_LENGTH = 20;

/** Who is playing: pick an existing player or add a new one. */
export function whoScreen(ctx: AppContext): Screen {
  let root: HTMLElement | null = null;

  function showTiles(profiles: Profile[]): void {
    const tiles = profiles.map(profile => {
      const tile = el('button', { class: 'tile', type: 'button' },
        el('img', { class: 'tile-avatar', src: avatarUrl(profile.avatar), alt: '' }),
        el('span', { class: 'tile-name' }, profile.name),
      );
      tile.addEventListener('click', async () => {
        await ctx.profiles.select(profile.id);
        ctx.navigate({ name: 'home' });
      });
      return tile;
    });

    const add = el('button', { class: 'tile tile-new', type: 'button' },
      el('span', { class: 'tile-plus', 'aria-hidden': 'true' }, '+'),
      el('span', { class: 'tile-name' }, COPY.newPlayer),
    );
    add.addEventListener('click', () => showForm(profiles));

    root?.replaceChildren(
      el('section', { class: 'who' },
        el('h1', { class: 'page-title' }, COPY.whoTitle),
        el('div', { class: 'tiles' }, ...tiles, add),
      ),
    );
  }

  function showForm(profiles: Profile[]): void {
    const nameInput = el('input', {
      class: 'field-input', id: 'player-name', type: 'text', maxlength: MAX_NAME_LENGTH,
      autocomplete: 'off', enterkeyhint: 'done',
    });

    const gradeOptions = GRADES.map(grade =>
      el('label', { class: 'pill' },
        el('input', { type: 'radio', name: 'grade', value: grade }),
        el('span', {}, COPY.grades[grade]),
      ));

    const avatarOptions = AVATARS.map((avatar, i) =>
      el('label', { class: 'avatar-pick' },
        el('input', { type: 'radio', name: 'avatar', value: avatar, checked: i === 0 }),
        el('img', { src: avatarUrl(avatar), alt: '' }),
      ));

    const submit = el('button', { class: 'btn btn-primary', type: 'submit', disabled: true }, COPY.start);

    const form = el('form', { class: 'who who-form', novalidate: true },
      el('h1', { class: 'page-title' }, COPY.newPlayer),
      el('div', { class: 'field' },
        el('label', { class: 'field-label', for: 'player-name' }, COPY.name),
        nameInput,
      ),
      el('fieldset', { class: 'field' },
        el('legend', { class: 'field-label' }, COPY.grade),
        el('div', { class: 'pills' }, ...gradeOptions),
      ),
      el('fieldset', { class: 'field', 'aria-label': COPY.newPlayer },
        el('div', { class: 'avatar-grid' }, ...avatarOptions),
      ),
      submit,
    );

    if (profiles.length > 0) {
      const back = el('button', { class: 'btn btn-quiet who-back', type: 'button' }, COPY.whoTitle);
      back.addEventListener('click', () => showTiles(profiles));
      form.append(back);
    }

    const chosen = (name: string): string | undefined =>
      form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
    const nameIsValid = (): boolean => {
      const length = [...nameInput.value.trim()].length;
      return length >= 1 && length <= MAX_NAME_LENGTH;
    };
    const refresh = (): void => {
      submit.disabled = !(nameIsValid() && chosen('grade') !== undefined);
      nameInput.removeAttribute('aria-invalid');
    };
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);

    let saving = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const grade = Number(chosen('grade')) as Grade;
      if (saving || !nameIsValid() || !GRADES.includes(grade)) return;
      saving = true;
      try {
        await ctx.profiles.add({ name: nameInput.value, grade, avatar: chosen('avatar') ?? AVATARS[0] });
        ctx.navigate({ name: 'home' });
      } catch (error) {
        saving = false;
        if (!(error instanceof InvalidProfileError)) throw error;
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
      }
    });

    root?.replaceChildren(form);
    nameInput.focus();
  }

  return {
    async mount(target: HTMLElement): Promise<void> {
      root = target;
      const profiles = await ctx.profiles.list();
      if (root !== target) return;
      if (profiles.length === 0) showForm(profiles);
      else showTiles(profiles);
    },
    unmount(): void {
      root = null;
    },
  };
}
