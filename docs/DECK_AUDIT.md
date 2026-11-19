# Deck & Rules Audit

Source: `Truth_or_Drink_Cut.pdf` (52 A4 pages, InDesign export, Feb 2022). This file records how the rules and cards were pulled from it and anything that was unclear.

## Where everything is in the PDF

| PDF pages | Contents | Notes |
|---|---|---|
| 1 | Rules: 2 players, 3+ players, card types, Buy a Round, the 4 sets, serving suggestions | Set names and icons are images; the text was read visually |
| 2 | Cutting template and printing notes | Not gameplay, so not used |
| 3–13 | **On the Rocks**, 99 cards | Card faces, 9 per page |
| 14 | On the Rocks card backs | Image only |
| 15–25 | **Last Call**, 99 cards | |
| 26 | Last Call backs | Image only |
| 27–37 | **Happy Hour**, 99 cards | |
| 38 | Happy Hour backs | Image only |
| 39–49 | **Extra Dirty**, 99 cards | |
| 50 | Extra Dirty backs | Image only |
| 51 | **Buy a Round** ×9, all identical | Image only, transcribed visually |
| 52 | Buy a Round backs (green) | Image only |

## Totals

- **Question cards: 396** (99 in each of the 4 sets). All of them are in `src/data/cards.js`. Each card's `src` field gives its page, row and column in the PDF.
- **Buy a Round cards: 9.** They are all the same, so the app models them as a count (`BUY_A_ROUND` in `src/data/rules.js`).
- **Rules: 27 statements.** 6 for 2 players, 6 for 3+ players, 5 for Straight Up, 4 for Make It a Double, 4 for This Round's On Me, 1 for Buy a Round, and the line about playing without booze. There are also 3 serving-suggestion tiers and the 4 set descriptions. They live in `src/data/rules.js`.

| Set | Straight Up | Make It a Double | This Round's On Me | Total |
|---|---|---|---|---|
| Happy Hour | 60 | 20 | 19 | 99 |
| On the Rocks | 64 | 20 | 15 | 99 |
| Last Call | 67 | 16 | 16 | 99 |
| Extra Dirty | 59 | 16 | 24 | 99 |

## Method

1. The PDF has a real text layer, and the GT Walsheim fonts are embedded. Text was taken from each of the 9 grid cells per page by its position, so nothing was OCR'd.
2. The set label at the top of each card is an image. The set was worked out from the label colour of every card: blue #1E9DE0, pink #EE2297, teal #12AF92 and red #EE2722. Every card on a given page came out in the same set.
3. Card types come from the coloured tag text on each card: STRAIGHT UP, MAKE IT A DOUBLE or THIS ROUND'S ON ME.
4. Line breaks were joined back into sentences. Curly quotes, apostrophes and em dashes were kept as printed.
5. Pages 3, 18 and 39 were checked by eye against rendered images of the pages.

## Items needing judgement

1. **p.4, row 2, col 1 (On the Rocks, `otr-013`).** The text overprints itself in the PDF. The last line is drawn twice and partly clipped, so the text layer reads as a jumble. From the rendered page it was transcribed as: *"What's something you understand about your parents now that you're grown up? Do they know you know?"* The type is Straight Up. The final sentence is the least certain part.
2. **p.18 (Last Call, `lc-030` and `lc-031`).** *"Have you ever had to apologize to someone for my behavior? Did the person accept the apology?"* is printed **twice**, in two neighbouring cells. Both copies are kept so the deck matches the PDF. Untick one in a future edit if you'd rather it came up only once.
3. **p.27 (Happy Hour, `hh-005`).** The line *"Close your eyes before asking this question:"* is printed in light italics as an instruction to the person asking. It is stored as the card's `note` and shown in grey italics above the question *"What color are my eyes?"*
4. **Italic emphasis.** Four cards print a word or phrase in bold italics. These are marked `*like this*` in the data and shown in italics: `otr-036` *still*, `hh-017` *know*, `hh-067` *something* and `xd-004` *public health reasons?*
5. **Fill-in-the-blank (p.37, `hh-093`).** *"Fill in the blank: I don't care if _________ is for kids…"* The blank is kept as printed underscores.
6. **The rules page says "See below" and "at right".** These refer to the page layout, so the app says "the serving suggestions" instead.

## Rule interpretations (gaps in the printed rules)

The app has to cover a few cases that the printed rules don't spell out:

- **Make It a Double when nobody answers.** The printed rules only cover "two answers" and "only one answer". When nobody gives a satisfying answer, the app uses the Straight Up rule: the person asking drinks and no point is awarded.
- **This Round's On Me with fewer than two answers.** With exactly one satisfying answer, that player gets the card automatically. With none, everyone has already drunk and the card is discarded with no point.
- **Losers of This Round's On Me / Make It a Double.** Players who gave a satisfying answer but weren't picked as the favourite each get one drink. Players who refused to answer already drank, so they don't drink again.
- **Buy a Round when someone has already drunk.** When the question is converted, the list of answers starts again from the asker's left. Any drinks already taken stay on the tally.
- **Not enough Buy a Round cards.** The PDF prints 9 cards, but the serving suggestions for 3–4 players call for up to 12 (3 each). The app deals the suggested number per player and doesn't cap it at 9. For 8 or more players, "deal out all" hands the 9 cards out in turn order.
- **"The older/oldest person goes first."** The app can't know ages, so whoever is listed first starts. The setup screen tells you to list the oldest player first.
- **Discarded draw-2 cards.** The card you don't pick is discarded as the rules say. It counts as drawn, so it won't come up again until you reshuffle.

## Not taken from the PDF (app additions)

- The **House Cards** stack, for custom prompts written during a session. It is gold (#F5B400) and isn't part of the printed game.
- Undo, the drink tally, saving the game in the browser, and the filters for set and card type.
