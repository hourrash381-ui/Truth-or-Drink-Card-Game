// Pure game engine: no DOM access. Every action mutates the `state` object it is given,
// so callers that want undo should snapshot (structuredClone / JSON) before calling.

import { CARDS } from './data/cards.js';
import { ALL_SETS, BUY_A_ROUND, SERVING, TYPES, TYPE_IDS } from './data/rules.js';

export const STATE_VERSION = 1;

const BASE = new Map(CARDS.map((c) => [c.id, c]));

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────────────────────── setup helpers ─────────────────────────

export const modeFor = (playerCount) => (playerCount === 2 ? 'duo' : 'group');

export function servingFor(playerCount) {
  return SERVING.find((s) => playerCount >= s.min && playerCount <= s.max) ?? null;
}

/** Buy a Round cards per player. `buyEach` is a number, or 'all' to deal out the 9 printed cards. */
export function dealBuys(playerCount, buyEach) {
  if (buyEach === 'all') {
    const counts = Array(playerCount).fill(0);
    for (let i = 0; i < BUY_A_ROUND.count; i++) counts[i % playerCount]++;
    return counts;
  }
  return Array(playerCount).fill(Math.max(0, Number(buyEach) || 0));
}

export function defaultSettings(playerCount = 4) {
  const s = servingFor(playerCount) ?? SERVING[0];
  return {
    sets: ['happy-hour', 'on-the-rocks', 'last-call', 'house'],
    types: [...TYPE_IDS],
    target: s.target,
    buyEach: s.buyEach,
    drawTwo: true,
    roundSize: 10,
  };
}

/** Re-derive the player-count-dependent settings (target / Buy a Round) from the serving suggestions. */
export function applyServing(settings, playerCount) {
  const s = servingFor(playerCount);
  return s ? { ...settings, target: s.target, buyEach: s.buyEach } : { ...settings };
}

// ───────────────────────── cards & piles ─────────────────────────

export function getCard(state, id) {
  return BASE.get(id) ?? state.custom.find((c) => c.id === id) ?? null;
}

export function allCards(state) {
  return [...CARDS, ...state.custom.filter((c) => !c.removed)];
}

export function cardMatches(card, settings) {
  return settings.sets.includes(card.set) && settings.types.includes(card.type);
}

/** Stack keys a player can draw from: one combined deck for 2 players, one stack per set otherwise. */
export function stackKeys(state) {
  if (state.mode === 'duo') return ['all'];
  return ALL_SETS.map((s) => s.id).filter((id) => state.settings.sets.includes(id));
}

export function buildPiles(state, rng = Math.random) {
  const used = new Set(state.used);
  const eligible = allCards(state).filter((c) => !used.has(c.id) && cardMatches(c, state.settings));
  const piles = {};
  if (state.mode === 'duo') {
    piles.all = shuffle(eligible.map((c) => c.id), rng);
  } else {
    for (const key of stackKeys(state)) {
      piles[key] = shuffle(eligible.filter((c) => c.set === key).map((c) => c.id), rng);
    }
  }
  state.piles = piles;
  return state;
}

export const remaining = (state) => Object.values(state.piles).reduce((n, p) => n + p.length, 0);

// ───────────────────────── game lifecycle ─────────────────────────

/**
 * @param {string[]} names  Player names, oldest first (the oldest player goes first).
 * @param {object} settings
 * @param {object[]} custom Custom cards to include in this game.
 */
export function createGame(names, settings, custom = [], rng = Math.random) {
  const clean = names.map((n, i) => String(n ?? '').trim() || `Player ${i + 1}`);
  if (clean.length < 2) throw new Error('Truth or Drink needs at least 2 players.');
  const mode = modeFor(clean.length);
  const buys = mode === 'group' ? dealBuys(clean.length, settings.buyEach) : clean.map(() => 0);
  const state = {
    v: STATE_VERSION,
    mode,
    players: clean.map((name, i) => ({ id: uid('p'), name, points: [], drinks: 0, truths: 0, buys: buys[i] })),
    settings: { ...settings },
    custom: custom.map((c) => ({ ...c })),
    used: [],
    piles: {},
    askerIdx: 0,
    round: 1,
    roundLeft: Math.max(1, Number(settings.roundSize) || 10),
    turn: { phase: 'draw' },
    winnerId: null,
    winnerSeen: false,
    lastResult: null,
    log: [],
    turnNo: 1,
  };
  return buildPiles(state, rng);
}

export const asker = (state) => state.players[state.askerIdx];

/** Players other than the asker, clockwise starting on the asker's left. */
export function others(state) {
  const n = state.players.length;
  const out = [];
  for (let k = 1; k < n; k++) out.push(state.players[(state.askerIdx + k) % n]);
  return out;
}

export const player = (state, id) => state.players.find((p) => p.id === id);

function note(state, text, kind = 'info') {
  state.lastResult = { text, kind, turnNo: state.turnNo };
  state.log.unshift({ text, turnNo: state.turnNo, at: Date.now() });
  if (state.log.length > 100) state.log.length = 100;
}

// ───────────────────────── turn actions ─────────────────────────

export function draw(state, stackKey, rng = Math.random) {
  if (state.turn.phase !== 'draw') return false;
  const pile = state.piles[stackKey];
  if (!pile || pile.length === 0) return false;
  state.lastResult = null;
  if (state.mode === 'group' && state.settings.drawTwo && pile.length >= 2) {
    const options = pile.splice(0, 2);
    state.used.push(...options);
    state.turn = { phase: 'pick', stack: stackKey, options };
  } else {
    const id = pile.shift();
    state.used.push(id);
    startAsk(state, id, stackKey);
  }
  if (state.mode === 'duo') state.roundLeft = Math.max(0, state.roundLeft - 1);
  return true;
}

/** Choose 1 of the 2 drawn cards; the other is discarded. */
export function pick(state, cardId) {
  if (state.turn.phase !== 'pick' || !state.turn.options.includes(cardId)) return false;
  startAsk(state, cardId, state.turn.stack);
  return true;
}

function startAsk(state, cardId, stack) {
  const card = getCard(state, cardId);
  state.turn = { phase: 'ask', stack, cardId, type: card?.type ?? 'straight-up', boughtBy: null, answers: [] };
}

const answerOf = (state, pid) => state.turn.answers.find((a) => a.pid === pid);
const truthsOf = (state) => state.turn.answers.filter((a) => a.result === 'truth');
const pendingOf = (state) => others(state).filter((p) => !answerOf(state, p.id));

/**
 * Record a player's response to the current card.
 * @param {'truth'|'drink'} result
 */
export function answer(state, pid, result) {
  const t = state.turn;
  if (t.phase !== 'ask') return false;
  const p = player(state, pid);
  if (!p || p.id === asker(state).id || answerOf(state, pid)) return false;
  if (result !== 'truth' && result !== 'drink') return false;

  t.answers.push({ pid, result });
  if (result === 'truth') p.truths++;
  else p.drinks++;

  if (state.mode === 'duo') {
    note(state, result === 'truth' ? `${p.name} told the truth.` : `${p.name} took a drink.`, result);
    return endTurn(state);
  }

  const truths = truthsOf(state);
  const pending = pendingOf(state);

  if (t.type === 'straight-up') {
    if (result === 'truth') return award(state, pid, []);
    if (pending.length === 0) return nobodyAnswered(state);
    return true;
  }

  if (t.type === 'double') {
    if (truths.length >= 2) {
      t.phase = 'award';
      t.candidates = truths.map((a) => a.pid);
      return true;
    }
    if (pending.length === 0) return truths.length === 1 ? onlyOne(state) : nobodyAnswered(state);
    return true;
  }

  // round-on-me: everyone gets a chance, then the asker picks a favorite.
  if (pending.length === 0) {
    if (truths.length >= 2) {
      t.phase = 'award';
      t.candidates = truths.map((a) => a.pid);
      return true;
    }
    if (truths.length === 1) return award(state, truths[0].pid, []);
    note(state, 'Nobody answered — everyone drank. The card is discarded.', 'drink');
    return endTurn(state);
  }
  return true;
}

/** Asker picks their favorite answer (Double / This Round's On Me). Losers drink. */
export function chooseFavorite(state, pid) {
  const t = state.turn;
  if (t.phase !== 'award' || !t.candidates.includes(pid)) return false;
  const losers = t.candidates.filter((id) => id !== pid);
  return award(state, pid, losers);
}

/** Double: only one satisfying answer could be found → it wins, asker drinks. */
export function onlyOne(state) {
  const t = state.turn;
  const truths = truthsOf(state);
  if (state.mode !== 'group' || t.phase !== 'ask' || t.type !== 'double' || truths.length !== 1) return false;
  asker(state).drinks++;
  return award(state, truths[0].pid, [], `${asker(state).name} could only find one good answer and drinks.`);
}

/** No one can (or will) answer → the asker picked the wrong question and drinks. */
export function nobodyAnswered(state) {
  const t = state.turn;
  if (state.mode !== 'group' || t.phase !== 'ask') return false;
  const a = asker(state);
  a.drinks++;
  note(state, `No one could answer — wrong question! ${a.name} drinks.`, 'drink');
  return endTurn(state);
}

/** A player turns in a Buy a Round card: the question becomes This Round's On Me. */
export function buyARound(state, pid) {
  const t = state.turn;
  const p = player(state, pid);
  if (state.mode !== 'group' || t.phase !== 'ask' || t.type === 'round-on-me' || !p || p.buys < 1) return false;
  p.buys--;
  t.type = 'round-on-me';
  t.boughtBy = pid;
  t.answers = []; // the question now goes to everyone, starting on the asker's left
  state.lastResult = { text: `${p.name} bought a round! Everyone answers (or drinks).`, kind: 'buy', turnNo: state.turnNo };
  return true;
}

function award(state, pid, losers, prefix = '') {
  const p = player(state, pid);
  const t = state.turn;
  p.points.push(t.cardId);
  for (const id of losers) player(state, id).drinks++;
  const loserNames = losers.map((id) => player(state, id).name);
  let text = `${p.name} wins the card (${p.points.length}/${state.settings.target}).`;
  if (loserNames.length) text += ` ${listNames(loserNames)} ${loserNames.length === 1 ? 'drinks' : 'drink'}.`;
  note(state, prefix ? `${prefix} ${text}` : text, 'truth');
  if (!state.winnerId && p.points.length >= state.settings.target) {
    state.winnerId = p.id;
    state.winnerSeen = false;
  }
  return endTurn(state);
}

function endTurn(state) {
  const n = state.players.length;
  state.askerIdx = (state.askerIdx + 1) % n;
  state.turnNo++;
  if (state.mode === 'duo' && state.roundLeft <= 0) state.turn = { phase: 'round-over' };
  else state.turn = { phase: 'draw' };
  return true;
}

/** 2 players: deal another round of cards. */
export function nextRound(state) {
  if (state.turn.phase !== 'round-over') return false;
  state.round++;
  state.roundLeft = Math.max(1, Number(state.settings.roundSize) || 10);
  state.turn = { phase: 'draw' };
  state.lastResult = null;
  return true;
}

/** Return every drawn card to the stacks and shuffle (the card in play, if any, stays out). */
export function reshuffle(state, rng = Math.random) {
  const t = state.turn;
  state.used = t.phase === 'ask' || t.phase === 'award' ? [t.cardId] : t.phase === 'pick' ? [...t.options] : [];
  return buildPiles(state, rng);
}

export function updateSettings(state, patch, rng = Math.random) {
  const prev = state.settings;
  state.settings = { ...prev, ...patch };
  if (state.settings.sets.join() !== prev.sets.join() || state.settings.types.join() !== prev.types.join()) {
    buildPiles(state, rng);
  }
  if (state.winnerId && player(state, state.winnerId)?.points.length < state.settings.target) {
    state.winnerId = null;
  }
  if (!state.winnerId) {
    const leader = state.players.find((p) => p.points.length >= state.settings.target);
    if (leader) {
      state.winnerId = leader.id;
      state.winnerSeen = false;
    }
  }
  return state;
}

// ───────────────────────── custom cards ─────────────────────────

export function makeCustomCard({ text, set = 'house', type = 'straight-up' }) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('A custom card needs some text.');
  if (!TYPES[type]) throw new Error(`Unknown card type: ${type}`);
  return { id: uid('c'), set, type, text: clean.slice(0, 280), custom: true };
}

/** Add a custom card to the running game. `playNext` puts it on top of its stack. */
export function addCustomCard(state, card, { playNext = false } = {}, rng = Math.random) {
  if (!state.custom.some((c) => c.id === card.id)) state.custom.push({ ...card });
  if (playNext) {
    if (!state.settings.sets.includes(card.set)) state.settings.sets = [...state.settings.sets, card.set];
    if (!state.settings.types.includes(card.type)) state.settings.types = [...state.settings.types, card.type];
    buildPiles(state, rng);
  }
  if (!cardMatches(card, state.settings) || state.used.includes(card.id)) return state;
  const key = state.mode === 'duo' ? 'all' : card.set;
  const pile = (state.piles[key] ??= []);
  const at = pile.indexOf(card.id);
  if (at >= 0) pile.splice(at, 1);
  if (playNext) pile.unshift(card.id);
  else pile.splice(Math.floor(rng() * (pile.length + 1)), 0, card.id);
  return state;
}

export function removeCustomCard(state, cardId) {
  const c = state.custom.find((x) => x.id === cardId);
  if (c) c.removed = true; // keep for lookups (it may already have been won as a point)
  for (const pile of Object.values(state.piles)) {
    const i = pile.indexOf(cardId);
    if (i >= 0) pile.splice(i, 1);
  }
  return state;
}

// ───────────────────────── players ─────────────────────────

export function renamePlayer(state, pid, name) {
  const p = player(state, pid);
  const clean = String(name ?? '').trim();
  if (!p || !clean) return false;
  p.name = clean.slice(0, 24);
  return true;
}

export function addPlayer(state, name) {
  if (state.mode !== 'group' || state.turn.phase !== 'draw') return false;
  const clean = String(name ?? '').trim().slice(0, 24) || `Player ${state.players.length + 1}`;
  const buys = state.settings.buyEach === 'all' ? 0 : Number(state.settings.buyEach) || 0;
  state.players.push({ id: uid('p'), name: clean, points: [], drinks: 0, truths: 0, buys });
  return true;
}

export function removePlayer(state, pid) {
  if (state.mode !== 'group' || state.players.length <= 3 || state.turn.phase !== 'draw') return false;
  const i = state.players.findIndex((p) => p.id === pid);
  if (i < 0) return false;
  state.players.splice(i, 1);
  if (i < state.askerIdx) state.askerIdx--;
  state.askerIdx %= state.players.length;
  if (state.winnerId === pid) state.winnerId = null;
  return true;
}

export const leader = (state) =>
  [...state.players].sort((a, b) => b.points.length - a.points.length || a.drinks - b.drinks)[0];

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
