// Sets, card types and rules, transcribed from the rules page of Truth_or_Drink_Cut.pdf.
// See docs/DECK_AUDIT.md for transcription notes.

/** The four question sets, ordered by intensity ("each more intimate than the last"). */
export const SETS = [
  {
    id: 'happy-hour',
    name: 'Happy Hour',
    intensity: 1,
    color: '#12af92',
    tagline: 'Get to know folks a little better. Because sometimes we all need help being nice.',
    nsfw: false,
  },
  {
    id: 'on-the-rocks',
    name: 'On the Rocks',
    intensity: 2,
    color: '#1e9de0',
    tagline: 'Slightly spicier questions for close friends—with just enough of a bite to help you loosen up together.',
    nsfw: false,
  },
  {
    id: 'last-call',
    name: 'Last Call',
    intensity: 3,
    color: '#ee2297',
    tagline: 'For when it’s getting late and you’ve got nothing left to lose. Put your best friendships to the ultimate test.',
    nsfw: false,
  },
  {
    id: 'extra-dirty',
    name: 'Extra Dirty',
    intensity: 4,
    color: '#ee2722',
    tagline: 'NSFW! All-too-personal adult-themed questions to pair with your adult beverages. Salacious and cringeworthy.',
    nsfw: true,
  },
];

/** Not in the PDF: a stack for prompts players write during a session. */
export const HOUSE_SET = {
  id: 'house',
  name: 'House Cards',
  intensity: 0,
  color: '#f5b400',
  tagline: 'Your own prompts, written during the session.',
  nsfw: false,
  custom: true,
};

export const ALL_SETS = [...SETS, HOUSE_SET];

export const setById = (id) => ALL_SETS.find((s) => s.id === id) ?? HOUSE_SET;

/** Card types. `bars` mirrors the 1/2/3 vertical bars printed beside each tag. */
export const TYPES = {
  'straight-up': {
    id: 'straight-up',
    label: 'Straight Up',
    bars: 1,
    short: 'Ask one person. A satisfying answer wins the card; otherwise they drink and you ask someone else.',
    rules: [
      'Ask one person.',
      'If they have a satisfying answer, award them the card as a point.',
      'You get to determine what counts as a satisfying answer.',
      'If they don’t have a good answer, or choose not to answer, they drink. Ask someone else!',
      'If no one can answer, you must have picked the wrong question. You drink!',
    ],
  },
  double: {
    id: 'double',
    label: 'Make It a Double',
    bars: 2,
    short: 'Keep asking until two people give satisfying answers. Award your favorite; the loser drinks.',
    rules: [
      'Like Straight Up, ask one person, until you get one satisfying answer.',
      'Then: Ask another person, until you get a second satisfying answer.',
      'Once two people have answered, award the card as a point to your favorite answer. The loser drinks.',
      'If you can only find one satisfying answer, give the card to that person, and take a drink yourself.',
    ],
  },
  'round-on-me': {
    id: 'round-on-me',
    label: 'This Round’s On Me',
    bars: 3,
    short: 'Everyone answers or drinks, starting on your left. Award your favorite; all losing players drink.',
    rules: [
      'Pose the question to the whole group.',
      'Starting with the person on your left, everyone must either answer, or drink.',
      'Once everyone has been given a chance to answer, award the card to your favorite.',
      'All losing players must drink!',
    ],
  },
};

export const TYPE_IDS = Object.keys(TYPES);

/** The Buy a Round card (printed 9×, identical, on page 51 of the PDF). */
export const BUY_A_ROUND = {
  count: 9,
  title: 'Buy a Round',
  color: '#3ba041',
  text: [
    'Play this card at any time. This converts any question to THIS ROUND’S ON ME.',
    'Now everyone has to answer (or drink).',
    'The original asker awards the point to their favorite answer, and all losing players must drink.',
  ],
  rule:
    'Turn in 1 of your Buy a Round cards at any time to convert any question into This Round’s On Me. This means everyone must answer the question (or drink)! The asker awards the point to their favorite answer.',
};

/** “Serving suggestions” for 3+ players. */
export const SERVING = [
  { players: '3–4', min: 3, max: 4, buyEach: 3, target: 5, deal: 'Deal everyone 3 Buy a Round cards', win: 'Collect 5 Question Cards to win' },
  { players: '5–7', min: 5, max: 7, buyEach: 2, target: 4, deal: 'Deal everyone 2 Buy a Round cards', win: 'Collect 4 Question Cards to win' },
  { players: '8+', min: 8, max: Infinity, buyEach: 'all', target: 3, deal: 'Deal out all the Buy a Round cards', win: 'Collect 3 Question Cards to win' },
];

export const RULES = {
  twoPlayers: [
    'Choose which card set(s) you’d like to play with. Shuffle them together and get your drinks ready.',
    'Deal 10 cards face-down. (Note: with 2 players, the different card types—Straight Up, etc.—don’t apply.)',
    'The older person goes first. Draw one card and ask the question!',
    'The other person must either tell the truth, or take a drink.',
    'They draw the next card, and ask that question to you.',
    'Once all 10 cards are gone, either clink glasses and call it a night, or deal out another round!',
  ],
  threePlus: [
    'Choose which card set(s) you want to play with, and make a separate stack of each to draw from.',
    'Deal out Buy a Round cards. See the serving suggestions for how many.',
    'The oldest person goes first! Draw 2 cards from the stack of your choice. Pick 1 card to ask. Discard the other.',
    'Ask the question! The instructions for each different card type are explained below.',
    'Once you’ve awarded the point, the turn ends, and play moves clockwise.',
    'The winner is the first to collect the number of cards specified in the serving suggestions. Make a toast to the truth!',
  ],
  setsIntro: 'Try all 4 sets of question cards: each more intimate than the last.',
  noBooze: 'It’s okay to play without booze. After all—the truth is also hard to swallow.',
};
