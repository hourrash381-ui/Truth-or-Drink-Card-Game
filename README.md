# Truth or Drink

A responsive party game you play by passing a phone around (or around one laptop). Answer the question honestly, or take a drink. It's built from the rules and the full card list of Cut's *Truth or Drink* printable PDF:

- **395 unique question cards** across four sets of rising intensity: Happy Hour → On the Rocks → Last Call → Extra Dirty (18+)
- **Buy a Round** cards, the three card types (Straight Up · Make It a Double · This Round's On Me), and the serving suggestions
- **Head-to-head mode** for 2 players, with 10-card rounds
- **Group mode** for 3 or more players: draw 2 and ask 1, points, a win target, and Buy a Round

It's a static site with **no build step and no dependencies**. It runs from GitHub Pages, any static host, or `npm start`.

## Play it

### On GitHub Pages (recommended for sharing)

1. Push to `main`. The workflow in `.github/workflows/pages.yml` runs the tests and then deploys.
2. One-time setup: go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Share `https://<your-user>.github.io/Truth-or-Drink-Card-Game/`. Every path in the app is relative, so it works under a repo sub-path.

### Locally (Node 18 or newer, nothing to install)

```bash
npm start
```

Then open http://localhost:5173.

To let phones on the same Wi-Fi join, run:

```bash
HOST=0.0.0.0 npm start
```

Then open `http://<your-computer's-LAN-IP>:5173` on each phone.

Any other static server works too, for example `python3 -m http.server`. You can't open `index.html` straight from the file system, because browsers block ES modules on `file://`.

### As a single HTML file (e.g. a Claude artifact)

```bash
npm run build:single
```

This writes `dist/truth-or-drink.html`, one self-contained page with all the CSS and JS inlined. It works anywhere that accepts a single HTML file.

### Tests

```bash
npm test
```

This uses the built-in `node:test` runner and checks the deck data and every turn rule.

### Build a deployable folder

```bash
npm run build
```

This copies the site into `dist/`, which you can drop onto Netlify, Vercel, S3 or a similar host.

## How it plays

| | 2 players | 3+ players |
|---|---|---|
| Deck | All chosen sets shuffled together | One stack per set; pick a stack each turn |
| Draw | 1 card | 2 cards: pick 1, discard the other (can be turned off) |
| Resolve | Tap **Truth** or **Drink** | Depends on the card type (below) |
| End | After 10 cards: deal another round or call it a night | First to the target number of cards wins |

- **Straight Up:** tap **Drink** for each person who won't answer (or gives a bad answer). The first **Truth** wins the card. If nobody answers, the person asking drinks.
- **Make It a Double:** keep going until there are two **Truth**s, then pick your favourite. The other one drinks. If you only get one good answer, that person wins and you drink.
- **This Round's On Me:** everyone answers in order, starting on the asker's left. Then the asker picks a favourite, and everyone else who answered drinks.
- **Buy a Round:** during any Straight Up or Double, anyone with a Buy a Round card can tap **Buy a Round** to turn the question into This Round's On Me.

Serving suggestions are applied automatically:

| Players | Buy a Round cards | Cards to win |
|---|---|---|
| 3–4 | 3 each | 5 |
| 5–7 | 2 each | 4 |
| 8+ | all 9 dealt out | 3 |

You can change these under **House rules & filters** on the setup screen, or in the **Deck** panel during a game.

**Other controls:**

- **Rules:** the full rules from the PDF.
- **+ Card:** write your own prompt. It goes into the gold **House Cards** stack, or any set you choose, and can be played next. Custom cards are saved in your browser for future games.
- **Deck:** filter by set (intensity) and card type, change the win target or round size, and see how many cards are left. Drawn cards never repeat until you **Reshuffle**.
- **Menu:** rename, add or remove players, rematch, end the game, see the recent log, and undo.
- **Undo:** steps back up to 40 actions.
- The game state is saved in `localStorage`, so refreshing the page doesn't lose your game.

## Project structure

```
index.html              App shell: top bar, <main id="app">, and the <dialog>s
manifest.webmanifest    "Add to Home Screen" metadata
assets/icon.svg         Favicon / app icon
src/
  app.js                UI: renders views from state, event delegation, dialogs
  game.js               Pure game engine (no DOM): decks, turns, scoring, Buy a Round
  storage.js            Guarded localStorage helpers
  icons.js              Inline SVG icons (set icons + UI)
  styles.css            Design tokens + all styles (mobile-first)
  data/
    cards.js            All 395 unique question cards from the PDF
    rules.js            Sets, card types, Buy a Round, serving suggestions, rules text
scripts/
  serve.mjs             Zero-dependency static dev server
  build.mjs             Copies deployable files into dist/
tests/game.test.mjs     Deck + rules tests (node:test)
docs/DECK_AUDIT.md      How the PDF was transcribed, plus ambiguities and rule interpretations
.github/workflows/pages.yml   Test → build → deploy to GitHub Pages
```

**Conventions**

- All game logic lives in `game.js`. Its functions mutate the state they're given, and `app.js` takes a snapshot before each action so Undo can restore it.
- Card data is plain ES-module JavaScript. Write `*word*` for italics and put asker instructions in `note`.
- Colours are CSS custom properties on `:root`. Set colours match the printed decks.
- Fonts come from Google Fonts (Archivo + DM Sans). If they can't load, the app falls back to system fonts.

## Credits

The card text and rules are from *Truth or Drink* by Cut ([PlayTruthOrDrink.com](https://playtruthordrink.com)). This is a fan-made digital table for a printable copy you own. Please don't redistribute the card text publicly without the rights holder's permission. Play responsibly: *it's okay to play without booze. After all, the truth is also hard to swallow.*
