# English Games Area

A browser games area where a child in grades 3-6 picks a profile and plays three
English-learning games: Letter Balloons, Listen and Catch, and Word and Object.
Stars and word progress are saved on the device. The interface is in Hebrew.

This is Step 1: no server, no accounts, no network calls except the app's own files.

## Run, test, build

You need Node.js 22 or newer. Run every command from this folder (`dev`).

```sh
npm install        # once
npm run dev        # start the app at http://localhost:5173
npm test           # unit tests
npm run typecheck  # TypeScript check
npm run build      # production files in dist/
npm run preview    # serve dist/ locally to check the build
```

`dist/` is a plain static site. Any static host can serve it.

## The published game

The game is online at https://assaf43.github.io/learn-english-game/.

Every push to the `main` branch on GitHub runs the tests, builds the app and publishes
it there within a minute or two (`.github/workflows/deploy.yml`). A failing test stops
the publish, and the previous version stays online. Progress of each run is under the
repository's "Actions" tab.

The build for publishing uses a relative base (`npm run build -- --base=./`) so the site
works from a sub-folder address.

## How the code is laid out

| Folder | What is in it |
|---|---|
| `src/core/` | Logic with no screen code: storage, profiles, word bank, word progress, stars, audio |
| `src/app/` | Router, Hebrew text (`copy.ts`), small helpers shared by the screens |
| `src/screens/` | "Who is playing", the games area, the end-of-round summary |
| `src/games/` | One folder per game: `logic.ts` (tested) and `screen.ts` |
| `src/data/words.json` | The word bank: 166 words with Hebrew, category and level |
| `public/` | Pictures, shapes, avatars and fonts. Sources and licences are in `ASSETS.md` |
| `tests/` | Unit tests for `src/core` and for each game's logic |

Hebrew interface text lives in `src/app/copy.ts`. Words and their translations live in
`src/data/words.json`; a new word also needs a picture at `public/img/words/<id>.svg`
(record its source in `ASSETS.md`).

## Audio files

The app ships with no audio files. Until they exist, every word and phrase is spoken by
the browser's built-in speech synthesis, so the games are playable but the voice depends
on the device.

To add real recordings:

1. Run `npm run audio:manifest`. It writes `audio-manifest.json`: a list of
   `{ "id": "...", "text": "..." }`, one entry per sound (166 words and 216 Listen and
   Catch phrases, 382 in all).
2. Produce one mp3 per entry that says `text`, with any text-to-speech tool or a human
   voice, and name it `<id>.mp3`. For example the entry `{ "id": "p2-red-ball", "text":
   "a red ball" }` becomes `p2-red-ball.mp3`.
3. Put the files in `public/audio/`.

Notes for whoever produces the files:

- Record at normal speed only. The turtle button and the replay after a mistake play the
  same file at 0.6 speed with the pitch kept.
- Keep silence at the start and end short; the game moves on about a second after a
  right answer.
- A file may be missing: the app then speaks that one entry with the browser voice.
- Run the manifest again after changing `words.json`.

## Link to the math game

The games area can show a "חשבון" card that opens another site. It appears only when
the address is set at build time. Create a file named `.env.local` in this folder:

```
VITE_MATH_GAME_URL=https://example.com/math
```

Then restart `npm run dev` or run `npm run build` again. The two games share nothing:
the card is only a link.

## Saved data and Step 2

Everything is saved in the browser's localStorage under keys that start with `eg.`:
`eg.profiles`, `eg.currentProfile`, and per player `eg.progress.<id>`, `eg.stars.<id>`,
`eg.settings.<id>`. Clearing the site's data in the browser removes all players.

When storage is unavailable or full (for example private mode on iOS), the app keeps
working and holds the data in memory until the page is closed.

No game or screen touches localStorage directly. All of them go through the
`StorageService` interface in `src/core/storage.ts`, and `src/main.ts` is the only place
that creates a `LocalStorageService`. Step 2 (accounts and cloud) replaces that one class
with an implementation that talks to a server; the interface is already async for that
reason. The empty `coupon-slot` element in the games-area header is reserved for the
Step 2 coupons button.

## Checks to do on real devices

These were not done by the builder and need a person with the devices: play one round of
each game at each difficulty on an Android phone (Chrome) and on an iPhone or iPad (Safari).

To open the app on a phone that is on the same Wi-Fi as the computer, start it with
`npm run dev -- --host` and open the "Network" address it prints (for example
`http://192.168.1.20:5173`) in the phone's browser. Data saved there belongs to that
address only.

- Sound starts after tapping "התחל", and the speaker and turtle buttons replay it.
  Listen for this on the iPhone or iPad in particular: with no audio files yet, the
  sound there depends on Safari allowing the browser voice.
- Nothing is cut off or needs sideways scrolling on a narrow phone.
- Turning the device keeps the game playable.
- After a reload the player, the stars and the known-words count are still there.
- In Letter Balloons the balloons are easy to hit and their speed feels right.
