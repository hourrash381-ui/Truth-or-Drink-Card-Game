import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS } from '../src/data/cards.js';
import { SETS, TYPE_IDS } from '../src/data/rules.js';
import * as G from '../src/game.js';

// Deterministic RNG (mulberry32) so shuffles are reproducible.
function rng(seed = 42) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_SETS = ['happy-hour', 'on-the-rocks', 'last-call', 'extra-dirty', 'house'];
const settings = (over = {}) => ({ ...G.defaultSettings(4), sets: ALL_SETS, ...over });

// ───────────── deck data ─────────────

test('deck: 396 question cards, 99 per set, unique ids', () => {
  assert.equal(CARDS.length, 396);
  for (const s of SETS) assert.equal(CARDS.filter((c) => c.set === s.id).length, 99, s.id);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
});

test('deck: every card has a valid type and non-empty text', () => {
  for (const c of CARDS) {
    assert.ok(TYPE_IDS.includes(c.type), `${c.id} type ${c.type}`);
    assert.ok(c.text.trim().length > 5, c.id);
    assert.ok(!/TODO|lorem/i.test(c.text), c.id);
    assert.ok(!/\s{2,}|— /.test(c.text), `${c.id} whitespace artifact`);
  }
});

test('deck: type distribution matches the transcription audit', () => {
  const count = (set, type) => CARDS.filter((c) => c.set === set && c.type === type).length;
  assert.deepEqual(
    SETS.map((s) => [s.id, count(s.id, 'straight-up'), count(s.id, 'double'), count(s.id, 'round-on-me')]),
    [
      ['happy-hour', 60, 20, 19],
      ['on-the-rocks', 64, 20, 15],
      ['last-call', 67, 16, 16],
      ['extra-dirty', 59, 16, 24],
    ],
  );
});

// ───────────── setup ─────────────

test('serving suggestions', () => {
  assert.deepEqual(G.dealBuys(4, 3), [3, 3, 3, 3]);
  assert.deepEqual(G.dealBuys(8, 'all'), [2, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(G.dealBuys(9, 'all').reduce((a, b) => a + b), 9);
  assert.equal(G.servingFor(3).target, 5);
  assert.equal(G.servingFor(6).target, 4);
  assert.equal(G.servingFor(12).target, 3);
  assert.equal(G.servingFor(2), null);
});

test('createGame: 2 players → duo with one combined pile', () => {
  const g = G.createGame(['Ann', 'Bo'], settings({ sets: ['happy-hour', 'last-call'] }), [], rng());
  assert.equal(g.mode, 'duo');
  assert.deepEqual(Object.keys(g.piles), ['all']);
  assert.equal(g.piles.all.length, 198);
  assert.ok(g.players.every((p) => p.buys === 0));
});

test('createGame: 3+ players → group with one stack per set and Buy a Round cards', () => {
  const g = G.createGame(['A', 'B', 'C', 'D', 'E'], G.applyServing(settings(), 5), [], rng());
  assert.equal(g.mode, 'group');
  assert.equal(g.piles['happy-hour'].length, 99);
  assert.equal(g.piles.house.length, 0);
  assert.ok(g.players.every((p) => p.buys === 2));
  assert.equal(g.settings.target, 4);
});

test('blank names fall back to Player N', () => {
  const g = G.createGame(['', ' Kim '], settings(), [], rng());
  assert.deepEqual(g.players.map((p) => p.name), ['Player 1', 'Kim']);
});

// ───────────── duo flow ─────────────

test('duo: alternate asking, 10-card rounds, no repeats', () => {
  const g = G.createGame(['Ann', 'Bo'], settings({ roundSize: 10 }), [], rng());
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    assert.equal(g.turn.phase, 'draw');
    const askerBefore = G.asker(g).id;
    assert.ok(G.draw(g, 'all', rng(i)));
    assert.equal(g.turn.phase, 'ask');
    assert.ok(!seen.has(g.turn.cardId));
    seen.add(g.turn.cardId);
    const target = G.others(g)[0];
    G.answer(g, target.id, i % 2 ? 'drink' : 'truth');
    assert.notEqual(G.asker(g).id, askerBefore);
  }
  assert.equal(g.turn.phase, 'round-over');
  assert.equal(g.players[0].truths + g.players[1].truths, 5);
  assert.equal(g.players[0].drinks + g.players[1].drinks, 5);
  assert.ok(G.nextRound(g));
  assert.equal(g.round, 2);
  assert.equal(g.roundLeft, 10);
});

// ───────────── group flow ─────────────

function groupGame(over = {}) {
  return G.createGame(['A', 'B', 'C', 'D'], settings(over), [], rng(7));
}

function forceCard(g, type) {
  // Draw until we hold a card of the requested type (ask phase).
  for (;;) {
    G.draw(g, 'happy-hour');
    const pickId = g.turn.options.find((id) => G.getCard(g, id).type === type) ?? g.turn.options[0];
    G.pick(g, pickId);
    if (g.turn.type === type) return;
    G.nobodyAnswered(g); // burn the turn
    g.askerIdx = 0;
  }
}

test('group: draw 2, pick 1, other is discarded (both marked used)', () => {
  const g = groupGame();
  const before = g.piles['happy-hour'].length;
  G.draw(g, 'happy-hour');
  assert.equal(g.turn.phase, 'pick');
  assert.equal(g.turn.options.length, 2);
  assert.equal(g.piles['happy-hour'].length, before - 2);
  const [keep, toss] = g.turn.options;
  G.pick(g, keep);
  assert.equal(g.turn.cardId, keep);
  assert.ok(g.used.includes(toss));
});

test('group: draw-two off draws a single card', () => {
  const g = groupGame({ drawTwo: false });
  G.draw(g, 'last-call');
  assert.equal(g.turn.phase, 'ask');
});

test('straight up: drink then truth → card to the truth-teller, turn moves clockwise', () => {
  const g = groupGame();
  forceCard(g, 'straight-up');
  const [b, c] = G.others(g);
  G.answer(g, b.id, 'drink');
  assert.equal(g.turn.phase, 'ask');
  G.answer(g, c.id, 'truth');
  assert.equal(b.drinks, 1);
  assert.equal(c.points.length, 1);
  assert.equal(G.asker(g).id, g.players[1].id);
  assert.equal(g.turn.phase, 'draw');
});

test('straight up: everyone drinks → asker drinks too', () => {
  const g = groupGame();
  forceCard(g, 'straight-up');
  const a = G.asker(g);
  const before = a.drinks;
  for (const p of G.others(g)) G.answer(g, p.id, 'drink');
  assert.equal(a.drinks, before + 1);
  assert.ok(g.players.every((p) => p.points.length === 0));
});

test('double: two truths → asker picks favorite, loser drinks', () => {
  const g = groupGame();
  forceCard(g, 'double');
  const [b, c, d] = G.others(g);
  G.answer(g, b.id, 'truth');
  G.answer(g, c.id, 'drink');
  G.answer(g, d.id, 'truth');
  assert.equal(g.turn.phase, 'award');
  G.chooseFavorite(g, d.id);
  assert.equal(d.points.length, 1);
  assert.equal(b.drinks, 1);
  assert.equal(c.drinks, 1);
});

test('double: only one satisfying answer → it wins, asker drinks', () => {
  const g = groupGame();
  forceCard(g, 'double');
  const a = G.asker(g);
  const before = a.drinks;
  const [b] = G.others(g);
  G.answer(g, b.id, 'truth');
  assert.ok(G.onlyOne(g));
  assert.equal(b.points.length, 1);
  assert.equal(a.drinks, before + 1);
});

test('round on me: everyone answers/drinks, favorite wins, all losers drink', () => {
  const g = groupGame();
  forceCard(g, 'round-on-me');
  const [b, c, d] = G.others(g);
  G.answer(g, b.id, 'truth');
  G.answer(g, c.id, 'truth');
  assert.equal(g.turn.phase, 'ask');
  G.answer(g, d.id, 'drink');
  assert.equal(g.turn.phase, 'award');
  G.chooseFavorite(g, c.id);
  assert.equal(c.points.length, 1);
  assert.equal(b.drinks, 1);
  assert.equal(d.drinks, 1);
  assert.equal(c.drinks, 0);
});

test('buy a round converts the question and spends the card', () => {
  const g = groupGame();
  forceCard(g, 'straight-up');
  const [b, c, d] = G.others(g);
  const buysBefore = d.buys;
  assert.ok(G.buyARound(g, d.id));
  assert.equal(d.buys, buysBefore - 1);
  assert.equal(g.turn.type, 'round-on-me');
  assert.equal(g.turn.boughtBy, d.id);
  assert.equal(G.buyARound(g, b.id), false, 'cannot buy twice');
  G.answer(g, b.id, 'truth');
  G.answer(g, c.id, 'drink');
  G.answer(g, d.id, 'drink');
  assert.equal(b.points.length, 1, 'single truth wins automatically');
});

test('winning: first to target is the winner', () => {
  const g = groupGame({ target: 1 });
  forceCard(g, 'straight-up');
  const [b] = G.others(g);
  G.answer(g, b.id, 'truth');
  assert.equal(g.winnerId, b.id);
});

// ───────────── deck controls ─────────────

test('reshuffle returns drawn cards; filters rebuild piles without repeats', () => {
  const g = groupGame();
  G.draw(g, 'happy-hour');
  G.pick(g, g.turn.options[0]);
  G.nobodyAnswered(g);
  assert.equal(g.piles['happy-hour'].length, 97);
  G.updateSettings(g, { types: ['double'] }, rng(3));
  assert.ok(g.piles['happy-hour'].every((id) => G.getCard(g, id).type === 'double'));
  assert.ok(g.piles['happy-hour'].every((id) => !g.used.includes(id)));
  G.updateSettings(g, { types: TYPE_IDS }, rng(3));
  G.reshuffle(g, rng(4));
  assert.equal(g.piles['happy-hour'].length, 99);
  assert.equal(g.used.length, 0);
});

test('custom cards: play-next puts the card on top of its stack', () => {
  const g = groupGame();
  const card = G.makeCustomCard({ text: '  Who here  would survive a zombie apocalypse? ', set: 'house', type: 'round-on-me' });
  assert.equal(card.text, 'Who here would survive a zombie apocalypse?');
  G.addCustomCard(g, card, { playNext: true });
  assert.equal(g.piles.house[0], card.id);
  G.draw(g, 'house');
  assert.equal(g.turn.phase, 'ask'); // only one card in the stack → no pick
  assert.equal(g.turn.cardId, card.id);
  assert.equal(g.turn.type, 'round-on-me');
});

test('custom cards: rejected when empty', () => {
  assert.throws(() => G.makeCustomCard({ text: '   ' }));
});

test('players: add / rename / remove between turns', () => {
  const g = groupGame();
  assert.ok(G.addPlayer(g, 'Eve'));
  assert.equal(g.players.length, 5);
  assert.ok(G.renamePlayer(g, g.players[4].id, 'Evelyn'));
  assert.equal(g.players[4].name, 'Evelyn');
  assert.ok(G.removePlayer(g, g.players[4].id));
  assert.equal(g.players.length, 4);
  G.draw(g, 'happy-hour');
  assert.equal(G.addPlayer(g, 'Late'), false, 'no roster changes mid-turn');
});
