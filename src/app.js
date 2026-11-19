// UI layer: renders the setup + game views from state and wires up events.
// All game rules live in game.js; this file only renders and dispatches.

import * as G from './game.js';
import { CARDS } from './data/cards.js';
import { ALL_SETS, BUY_A_ROUND, RULES, SERVING, SETS, TYPES, TYPE_IDS, setById } from './data/rules.js';
import { load, remove, save } from './storage.js';
import { icons, setIcon } from './icons.js';

// ───────────────────────── helpers ─────────────────────────

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Escapes text, then turns `*word*` (italics on the printed card) into <em>. */
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const MAX_UNDO = 40;

// ───────────────────────── app state ─────────────────────────

function loadGame() {
  const g = load('game', null);
  return g && g.v === G.STATE_VERSION && Array.isArray(g.players) ? g : null;
}

const defaultSetup = () => ({ names: ['', '', ''], settings: G.defaultSettings(3), quickCount: 4 });

const app = {
  game: loadGame(),
  setup: { ...defaultSetup(), ...load('setup', {}) },
  library: load('library', []),
  undo: [],
  lastAnimated: null,
  ui: { buyOpen: false, flash: '' },
};

function persist() {
  save('setup', app.setup);
  save('library', app.library);
  if (app.game) save('game', app.game);
  else remove('game');
}

/** Run a game action with an undo snapshot, then persist + re-render. */
function act(fn) {
  if (!app.game) return;
  const snapshot = JSON.stringify(app.game);
  const changed = fn(app.game);
  if (changed === false) return;
  app.undo.push(snapshot);
  if (app.undo.length > MAX_UNDO) app.undo.shift();
  app.ui.buyOpen = false;
  persist();
  render();
}

function undo() {
  const prev = app.undo.pop();
  if (!prev) return;
  app.game = JSON.parse(prev);
  app.lastAnimated = app.game.turn?.cardId ?? null; // don't replay the flip
  persist();
  render();
}

// ───────────────────────── card rendering ─────────────────────────

const LOGO = `<span class="wordmark">TRUTH<span class="wordmark__or">or</span>DRINK</span>`;

function cardFront(card, { type, boughtBy, mode, compact = false } = {}) {
  const set = setById(card.set);
  const t = TYPES[type ?? card.type];
  const long = card.text.length > 120 ? ' card__q--long' : card.text.length > 80 ? ' card__q--mid' : '';
  const typeMuted = mode === 'duo' ? ' card__type--muted' : '';
  return `
    <article class="card${compact ? ' card--compact' : ''}" style="--set:${set.color}">
      <div class="card__set">${setIcon(set.id, 16)}<span>${esc(set.name)}</span></div>
      <div class="card__type${typeMuted}" title="${mode === 'duo' ? 'Card types don’t apply with 2 players' : esc(t.short)}">
        <span>${esc(t.label)}</span><i class="bars" data-n="${t.bars}"></i>
      </div>
      ${card.note ? `<p class="card__note">${rich(card.note)}</p>` : ''}
      <p class="card__q${long}">${rich(card.text)}</p>
      ${boughtBy ? `<div class="card__stamp">Round bought by ${esc(boughtBy)}</div>` : ''}
      ${card.custom ? `<div class="card__custom">House card</div>` : ''}
      <div class="card__logo">${LOGO}</div>
    </article>`;
}

function cardBack(setId) {
  const color = setId === 'all' ? 'var(--rainbow)' : setById(setId).color;
  return `<div class="card-back" style="--set:${color}"><div class="card-back__art">${LOGO}</div></div>`;
}

function flipCard(card, opts) {
  const animate = app.lastAnimated !== card.id && !reduceMotion();
  app.lastAnimated = card.id;
  return `
    <div class="flip${animate ? ' flip--anim' : ''}">
      <div class="flip__inner">
        <div class="flip__face flip__face--back">${cardBack(card.set)}</div>
        <div class="flip__face flip__face--front">${cardFront(card, opts)}</div>
      </div>
    </div>`;
}

// ───────────────────────── setup view ─────────────────────────

function setCounts(setId) {
  const base = CARDS.filter((c) => c.set === setId).length;
  return base + app.library.filter((c) => c.set === setId).length;
}

function setTiles(selected, { counts } = {}) {
  return ALL_SETS.map((s) => {
    const on = selected.includes(s.id);
    const total = setCounts(s.id);
    const count = counts ? counts(s.id) : plural(total, 'card');
    return `
      <button type="button" class="set-tile${on ? ' is-on' : ''}" style="--set:${s.color}" data-action="toggle-set" data-set="${s.id}" aria-pressed="${on}">
        <span class="set-tile__head">${setIcon(s.id, 22)}<b>${esc(s.name)}</b>${s.nsfw ? '<span class="tag-18">18+</span>' : ''}</span>
        <span class="set-tile__tag">${esc(s.tagline)}</span>
        <span class="set-tile__meta">
          ${s.intensity ? `<span class="heat" aria-label="Intensity ${s.intensity} of 4">${'●'.repeat(s.intensity)}${'○'.repeat(4 - s.intensity)}</span>` : '<span class="heat">custom</span>'}
          <span>${count}</span>
        </span>
        <span class="set-tile__check">${icons.check}</span>
      </button>`;
  }).join('');
}

function typeToggles(selected) {
  return TYPE_IDS.map((id) => {
    const t = TYPES[id];
    const on = selected.includes(id);
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="toggle-type" data-type="${id}" aria-pressed="${on}">
      <i class="bars" data-n="${t.bars}"></i>${esc(t.label)}</button>`;
  }).join('');
}

function stepper(action, value, label, { min = 1, max = 99, suffix = '' } = {}) {
  return `<div class="stepper" role="group" aria-label="${esc(label)}">
    <button type="button" data-action="${action}" data-delta="-1" ${value <= min ? 'disabled' : ''} aria-label="Decrease">−</button>
    <output>${esc(value)}${suffix}</output>
    <button type="button" data-action="${action}" data-delta="1" ${value >= max ? 'disabled' : ''} aria-label="Increase">+</button>
  </div>`;
}

function modeSummary(n, settings) {
  if (n < 2) return 'Add at least 2 players.';
  if (n === 2) return `<b>Head-to-head.</b> All chosen sets shuffled together · ${settings.roundSize}-card rounds · card types don’t apply.`;
  const buys = settings.buyEach === 'all' ? `all ${BUY_A_ROUND.count} Buy a Round cards dealt out` : `${plural(settings.buyEach, 'Buy a Round card')} each`;
  return `<b>Group game.</b> Draw 2, ask 1 · first to ${plural(settings.target, 'card')} wins · ${buys}.`;
}

function setupProblems(settings) {
  const problems = [];
  if (!settings.sets.some((id) => setCounts(id) > 0)) problems.push('Pick at least one set with cards in it.');
  if (!settings.types.length) problems.push('Pick at least one card type.');
  return problems;
}

function setupView() {
  const { names, quickCount } = app.setup;
  const n = names.filter((x) => x.trim()).length;
  const settings = effectiveSettings(n);
  const problems = setupProblems(settings);
  return `
  <section class="setup">
    <div class="hero">
      <p class="eyebrow">A party game of questions</p>
      <h1 class="hero__logo">${LOGO}</h1>
      <p class="hero__lede">Answer the question honestly… <span class="nowrap">or take a drink.</span></p>
    </div>

    <div class="setup__grid">
      <div class="panel">
        <h2 class="bar-title">Who’s playing?</h2>
        <p class="hint">List the oldest player first — they go first.</p>
        <ol class="name-list">
          ${names.map((name, i) => `
            <li class="name-row">
              <span class="name-row__n">${i + 1}</span>
              <input type="text" value="${esc(name)}" placeholder="Player ${i + 1}" maxlength="24" data-bind="name" data-i="${i}" aria-label="Player ${i + 1} name" autocomplete="off" enterkeyhint="next">
              <button type="button" class="icon-btn" data-action="move-name" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icons.up}</button>
              <button type="button" class="icon-btn" data-action="remove-name" data-i="${i}" ${names.length <= 2 ? 'disabled' : ''} aria-label="Remove player">${icons.trash}</button>
            </li>`).join('')}
        </ol>
        <button type="button" class="btn btn--ghost btn--block" data-action="add-name" ${names.length >= 20 ? 'disabled' : ''}>${icons.plus} Add player</button>
        <p class="mode-summary" id="mode-summary">${modeSummary(n, settings)}</p>
      </div>

      <div class="panel">
        <h2 class="bar-title">Pick your sets</h2>
        <p class="hint">Each set is more intimate than the last. In a group game, each set is its own stack.</p>
        <div class="set-grid">${setTiles(settings.sets)}</div>
        <details class="advanced">
          <summary>House rules &amp; filters</summary>
          <div class="field"><span class="field__label">Card types</span><div class="chips">${typeToggles(settings.types)}</div></div>
          <div class="field field--row"><span class="field__label">Cards to win <small>(3+ players)</small></span>${stepper('setup-target', settings.target, 'Cards to win', { min: 1, max: 20 })}</div>
          <div class="field field--row"><span class="field__label">Buy a Round cards each <small>(3+ players)</small></span>
            <div class="buy-ctl">${settings.buyEach === 'all'
              ? `<span class="pill">Deal out all ${BUY_A_ROUND.count}</span><button type="button" class="link-btn" data-action="setup-buy-fixed">set per player</button>`
              : `${stepper('setup-buy', settings.buyEach, 'Buy a Round cards each', { min: 0, max: 9 })}<button type="button" class="link-btn" data-action="setup-buy-all">deal all ${BUY_A_ROUND.count}</button>`}</div>
          </div>
          <div class="field field--row"><span class="field__label">Draw 2, pick 1 <small>(3+ players)</small></span>
            <button type="button" class="switch${settings.drawTwo ? ' is-on' : ''}" data-action="setup-draw-two" role="switch" aria-checked="${settings.drawTwo}"><span></span></button></div>
          <div class="field field--row"><span class="field__label">Cards per round <small>(2 players)</small></span>${stepper('setup-round', settings.roundSize, 'Cards per round', { min: 1, max: 50 })}</div>
          <p class="hint">${app.setup.servingLocked ? 'Using your custom win/Buy a Round values. ' : 'Cards-to-win and Buy a Round follow the serving suggestions for your player count. '}They reset to the suggestions whenever you add or remove a player.</p>
        </details>
      </div>
    </div>

    <div class="cta">
      ${problems.length ? `<p class="warn">${problems.map(esc).join(' ')}</p>` : ''}
      <button type="button" class="btn btn--primary btn--xl" data-action="start" ${problems.length || n < 2 ? 'disabled' : ''}>Start game${n >= 2 ? ` · ${n} players` : ''}</button>
      <div class="quick">
        <span class="quick__label">${icons.bolt} Quick start — skip the names</span>
        ${stepper('quick-count', quickCount, 'Number of players', { min: 2, max: 20, suffix: ' players' })}
        <button type="button" class="btn btn--light" data-action="quick" ${problems.length ? 'disabled' : ''}>Jump in</button>
      </div>
    </div>
  </section>`;
}

// ───────────────────────── game view ─────────────────────────

function turnBanner(g) {
  const a = G.asker(g);
  const t = g.turn;
  const eyebrow =
    g.mode === 'duo'
      ? `Round ${g.round} · ${t.phase === 'round-over' ? 'all cards played' : `card ${g.settings.roundSize - g.roundLeft + (t.phase === 'draw' ? 1 : 0)} of ${g.settings.roundSize}`}`
      : `Turn ${g.turnNo} · first to ${plural(g.settings.target, 'card')}`;
  let headline;
  if (t.phase === 'round-over') headline = `Round ${g.round} is done.`;
  else if (t.phase === 'draw') headline = `<span class="who">${esc(a.name)}</span>, draw a card.`;
  else if (t.phase === 'pick') headline = `<span class="who">${esc(a.name)}</span>, pick one to ask.`;
  else if (t.phase === 'award') headline = `<span class="who">${esc(a.name)}</span>, pick your favorite.`;
  else if (g.mode === 'duo') headline = `<span class="who">${esc(a.name)}</span> asks <span class="who">${esc(G.others(g)[0].name)}</span>.`;
  else if (t.type === 'round-on-me') headline = `<span class="who">${esc(a.name)}</span> asks everyone.`;
  else headline = `<span class="who">${esc(a.name)}</span> is asking.`;

  const last = g.lastResult;
  return `
    <div class="turn-banner">
      <p class="eyebrow">${eyebrow}</p>
      <h2 class="turn-banner__h">${headline}</h2>
      <p class="result${last ? ` result--${last.kind}` : ''}" role="status" aria-live="polite">${last ? esc(last.text) : ''}</p>
    </div>`;
}

function pilesView(g) {
  const keys = G.stackKeys(g).filter((k) => k === 'all' || setCounts(k) > 0);
  const total = G.remaining(g);
  if (total === 0) {
    return `<div class="empty">
      <p class="empty__h">The deck is empty.</p>
      <p>Every card matching your filters has been drawn.</p>
      <div class="row-btns">
        <button type="button" class="btn btn--primary" data-action="reshuffle">${icons.shuffle} Reshuffle</button>
        <button type="button" class="btn btn--light" data-action="open" data-dlg="deck">${icons.deck} Change sets</button>
      </div>
    </div>`;
  }
  return `<div class="piles piles--${keys.length}">
    ${keys.map((k) => {
      const n = g.piles[k]?.length ?? 0;
      const name = k === 'all' ? 'Draw a card' : setById(k).name;
      return `<button type="button" class="pile" data-action="draw" data-stack="${k}" ${n ? '' : 'disabled'} aria-label="${esc(name)}: ${n} left">
        <span class="pile__stack">${cardBack(k)}</span>
        <span class="pile__label">${k === 'all' ? '' : setIcon(k, 16)}${esc(name)}</span>
        <span class="pile__count">${n} left</span>
      </button>`;
    }).join('')}
  </div>`;
}

function stageView(g) {
  const t = g.turn;
  if (t.phase === 'draw') return pilesView(g);
  if (t.phase === 'pick') {
    return `<div class="pick">
      ${t.options.map((id) => {
        const c = G.getCard(g, id);
        return `<button type="button" class="pick__opt" data-action="pick" data-id="${esc(id)}" aria-label="Ask: ${esc(c.text.replace(/\*/g, ''))}">${cardFront(c, { mode: g.mode, compact: true })}<span class="pick__cta">Ask this one</span></button>`;
      }).join('')}
    </div>`;
  }
  if (t.phase === 'round-over') {
    const [a, b] = g.players;
    return `<div class="empty empty--round">
      ${icons.cheers}
      <p class="empty__h">That’s ${plural(g.settings.roundSize, 'card')}.</p>
      <p>Clink glasses and call it a night… or deal out another round!</p>
      <p class="duo-tally">${esc(a.name)}: ${plural(a.truths, 'truth')}, ${plural(a.drinks, 'drink')} · ${esc(b.name)}: ${plural(b.truths, 'truth')}, ${plural(b.drinks, 'drink')}</p>
      <div class="row-btns">
        <button type="button" class="btn btn--primary" data-action="next-round" ${G.remaining(g) ? '' : 'disabled'}>Deal another round</button>
        <button type="button" class="btn btn--light" data-action="end-game">Call it a night</button>
      </div>
      ${G.remaining(g) ? '' : '<p class="hint">No cards left — reshuffle from the Deck menu first.</p>'}
    </div>`;
  }
  const card = G.getCard(g, t.cardId);
  const bought = t.boughtBy ? G.player(g, t.boughtBy)?.name : null;
  return `<div class="stage__card">${flipCard(card, { type: t.type, boughtBy: bought, mode: g.mode })}</div>`;
}

function actionsView(g) {
  const t = g.turn;
  const a = G.asker(g);
  if (t.phase === 'draw') {
    return g.mode === 'duo'
      ? `<p class="how">Tap the deck, then read the card out loud to <b>${esc(G.others(g)[0].name)}</b>. They tell the truth — or drink.</p>`
      : `<p class="how">${g.settings.drawTwo ? 'Tap a stack to draw <b>2 cards</b>. You’ll pick 1 to ask and discard the other.' : 'Tap a stack to draw a card.'}</p>`;
  }
  if (t.phase === 'pick') return `<p class="how">Read both to yourself. Pick <b>1</b> to ask — the other is discarded.</p>`;
  if (t.phase === 'round-over') return '';

  if (g.mode === 'duo') {
    const target = G.others(g)[0];
    return `
      <div class="decide">
        <p class="decide__q"><b>${esc(target.name)}</b>, truth or drink?</p>
        <div class="decide__btns">
          <button type="button" class="btn btn--truth btn--xl" data-action="answer" data-pid="${target.id}" data-result="truth">${icons.check} Truth</button>
          <button type="button" class="btn btn--drink btn--xl" data-action="answer" data-pid="${target.id}" data-result="drink">${icons.glass} Drink</button>
        </div>
        <p class="hint">With 2 players, card types don’t apply — every card is just truth or drink.</p>
      </div>`;
  }

  const type = TYPES[t.type];
  if (t.phase === 'award') {
    return `
      <div class="decide">
        <p class="how"><b>${esc(a.name)}</b>, who gave the best answer? They win the card — every other answerer drinks.</p>
        <div class="fav-list">
          ${t.candidates.map((pid) => `<button type="button" class="btn btn--fav" data-action="favorite" data-pid="${pid}">${esc(G.player(g, pid).name)}</button>`).join('')}
        </div>
      </div>`;
  }

  const truths = t.answers.filter((x) => x.result === 'truth').length;
  const list = G.others(g);
  const nextUp = t.type === 'round-on-me' ? list.find((p) => !t.answers.some((x) => x.pid === p.id))?.id : null;
  const buyers = g.players.filter((p) => p.buys > 0);
  const extra = [];
  if (t.type === 'double' && truths === 1) {
    extra.push(`<button type="button" class="btn btn--light" data-action="only-one">Only one good answer — award it, ${esc(a.name)} drinks</button>`);
  }
  if (t.type !== 'round-on-me' && truths === 0) {
    extra.push(`<button type="button" class="btn btn--light" data-action="nobody">No one can answer — ${esc(a.name)} drinks</button>`);
  }
  let buy = '';
  if (t.type !== 'round-on-me' && buyers.length) {
    buy = `
      <div class="buy">
        <button type="button" class="btn btn--buy" data-action="toggle-buy" aria-expanded="${app.ui.buyOpen}">Buy a Round</button>
        ${app.ui.buyOpen ? `<div class="buy__who"><span>Who’s turning in a card?</span>
          ${buyers.map((p) => `<button type="button" class="chip chip--buy" data-action="buy" data-pid="${p.id}">${esc(p.name)} <small>×${p.buys}</small></button>`).join('')}</div>` : ''}
      </div>`;
  }

  return `
    <div class="ask">
      <div class="ask__type" style="--set:${setById(G.getCard(g, t.cardId).set).color}">
        <span class="ask__label"><i class="bars" data-n="${type.bars}"></i>${esc(type.label)}</span>
        <p>${esc(type.short)}</p>
      </div>
      ${t.type === 'double' ? `<p class="progress">Satisfying answers: <b>${truths}/2</b></p>` : ''}
      <ul class="answers">
        ${list.map((p) => {
          const ans = t.answers.find((x) => x.pid === p.id);
          const status = ans ? (ans.result === 'truth' ? `<span class="ans__status ans__status--truth">${icons.check} Answered</span>` : `<span class="ans__status ans__status--drink">${icons.glass} Drank</span>`) : '';
          return `<li class="ans${ans ? ' is-done' : ''}${nextUp === p.id ? ' is-next' : ''}">
            <span class="ans__name">${esc(p.name)}${nextUp === p.id ? '<small>up next</small>' : ''}</span>
            ${status || `<span class="ans__btns">
              <button type="button" class="btn btn--truth btn--sm" data-action="answer" data-pid="${p.id}" data-result="truth">Truth</button>
              <button type="button" class="btn btn--drink btn--sm" data-action="answer" data-pid="${p.id}" data-result="drink">Drink</button>
            </span>`}
          </li>`;
        }).join('')}
      </ul>
      <p class="hint">${t.type === 'straight-up' ? 'Truth = a satisfying answer (you decide). Drink = no answer or a bad one.' : t.type === 'double' ? 'Keep asking until two people give satisfying answers.' : 'Everyone must answer or drink, starting on the asker’s left.'}</p>
      ${extra.length ? `<div class="extra">${extra.join('')}</div>` : ''}
      ${buy}
    </div>`;
}

function scoreboard(g) {
  const asker = G.asker(g);
  const top = Math.max(...g.players.map((p) => p.points.length));
  return `
    <div class="score">
      <h3 class="mini-title">${g.mode === 'duo' ? 'Tally' : 'Scoreboard'}</h3>
      <ul class="score__list">
        ${g.players.map((p) => `
          <li class="score__p${p.id === asker.id ? ' is-turn' : ''}${g.mode === 'group' && top > 0 && p.points.length === top ? ' is-lead' : ''}">
            <span class="score__name">${esc(p.name)}${p.id === asker.id ? '<small>asking</small>' : ''}</span>
            ${g.mode === 'group'
              ? `<span class="score__pts" title="${plural(p.points.length, 'card')} won">
                  ${p.points.map((id) => `<i class="pt" style="--set:${setById(G.getCard(g, id)?.set).color}"></i>`).join('')}
                  ${Array.from({ length: Math.max(0, g.settings.target - p.points.length) }, () => '<i class="pt pt--empty"></i>').join('')}
                </span>`
              : `<span class="score__stat" title="Truths told">${icons.check}${p.truths}</span>`}
            <span class="score__stat score__stat--drink" title="Drinks taken">${icons.glass}${p.drinks}</span>
            ${g.mode === 'group' ? `<span class="score__buy${p.buys ? '' : ' is-zero'}" title="Buy a Round cards">BAR×${p.buys}</span>` : ''}
          </li>`).join('')}
      </ul>
    </div>`;
}

function deckStatus(g) {
  const keys = G.stackKeys(g).filter((k) => k === 'all' || setCounts(k) > 0);
  return `
    <div class="deck-status">
      <span><b>${G.remaining(g)}</b> cards left${g.mode === 'group' ? ` <small>(${keys.map((k) => `${esc(setById(k).name)} ${g.piles[k]?.length ?? 0}`).join(' · ')})</small>` : ''}</span>
      <button type="button" class="link-btn" data-action="reshuffle">${icons.shuffle} Reshuffle</button>
    </div>`;
}

function gameView(g) {
  return `
  <section class="game game--${g.mode} phase--${g.turn.phase}">
    ${turnBanner(g)}
    <div class="table">
      <div class="stage">${stageView(g)}</div>
      <aside class="side">
        <div class="actions">${actionsView(g)}</div>
        ${scoreboard(g)}
        ${deckStatus(g)}
      </aside>
    </div>
  </section>`;
}

// ───────────────────────── dialogs ─────────────────────────

function rulesHTML() {
  const typeBlock = (id) => {
    const t = TYPES[id];
    return `<div class="rule-type"><h4><i class="bars" data-n="${t.bars}"></i>${esc(t.label)}</h4><ul>${t.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  };
  return `
    <header class="dlg__head"><h2>How to play</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></header>
    <div class="dlg__body rules">
      <section><h3 class="bar-title">2 players only</h3><ul class="bullets">${RULES.twoPlayers.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>
      <section><h3 class="bar-title">3 players or more</h3><ul class="bullets">${RULES.threePlus.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>
      <section><h3 class="bar-title">The card types</h3><div class="rule-types">${TYPE_IDS.map(typeBlock).join('')}
        <div class="rule-type rule-type--buy"><h4>Buy a Round</h4><p>${esc(BUY_A_ROUND.rule)}</p></div></div></section>
      <section><h3 class="bar-title">Serving suggestions</h3>
        <table class="serving"><tbody>${SERVING.map((s) => `<tr><th>${esc(s.players)}<small>players</small></th><td>${esc(s.deal)}<br>${esc(s.win)}</td></tr>`).join('')}</tbody></table>
      </section>
      <section><h3 class="bar-title">${esc(RULES.setsIntro)}</h3>
        <ul class="set-list">${SETS.map((s) => `<li style="--set:${s.color}">${setIcon(s.id, 20)}<div><b>${esc(s.name)}</b><span>${esc(s.tagline)}</span></div></li>`).join('')}</ul>
      </section>
      <p class="no-booze">${esc(RULES.noBooze)}</p>
      <section><h3 class="bar-title">In this app</h3><ul class="bullets">
        <li>Tap <b>Truth</b> when someone gives a satisfying answer, <b>Drink</b> when they don’t (or won’t). The app awards points, tallies drinks and moves the turn clockwise.</li>
        <li>Drawn cards never repeat until you <b>Reshuffle</b> (Deck menu or the link under the scoreboard).</li>
        <li>Mis-tap? Use <b>Undo</b> in the top bar.</li>
        <li>Your game is saved in this browser, so a refresh won’t lose it.</li>
      </ul></section>
    </div>`;
}

function customHTML() {
  const g = app.game;
  const defaultSet = 'house';
  return `
    <header class="dlg__head"><h2>Add a custom card</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></header>
    <form class="dlg__body custom" id="custom-form" novalidate>
      <label class="field"><span class="field__label">Your question</span>
        <textarea name="text" rows="3" maxlength="280" required placeholder="What’s a secret you’ve kept from everyone in this room?"></textarea></label>
      <fieldset class="field"><legend class="field__label">Stack</legend><div class="chips">
        ${ALL_SETS.map((s) => `<label class="chip chip--radio" style="--set:${s.color}"><input type="radio" name="set" value="${s.id}" ${s.id === defaultSet ? 'checked' : ''}>${setIcon(s.id, 16)}${esc(s.name)}</label>`).join('')}
      </div></fieldset>
      <fieldset class="field"><legend class="field__label">Card type ${g?.mode === 'duo' ? '<small>(doesn’t apply with 2 players)</small>' : ''}</legend><div class="chips">
        ${TYPE_IDS.map((id) => `<label class="chip chip--radio"><input type="radio" name="type" value="${id}" ${id === 'straight-up' ? 'checked' : ''}><i class="bars" data-n="${TYPES[id].bars}"></i>${esc(TYPES[id].label)}</label>`).join('')}
      </div></fieldset>
      ${g ? '<label class="check"><input type="checkbox" name="next" checked> Put it on top — play it next</label>' : ''}
      <p class="form-msg" id="custom-msg" role="status"></p>
      <div class="dlg__actions">
        <button type="button" class="btn btn--light" data-close>Done</button>
        <button type="submit" class="btn btn--primary">${icons.plus} Add card</button>
      </div>
    </form>
    <div class="dlg__body library" id="library">${libraryHTML()}</div>`;
}

function libraryHTML() {
  if (!app.library.length) return '<p class="hint">Cards you add are saved in this browser and shuffled into future games too.</p>';
  return `<h3 class="mini-title">Your cards (${app.library.length})</h3>
    <ul class="lib-list">${app.library.map((c) => `
      <li style="--set:${setById(c.set).color}"><span class="lib-dot"></span><span class="lib-text">${esc(c.text)}<small>${esc(setById(c.set).name)} · ${esc(TYPES[c.type].label)}</small></span>
        <button type="button" class="icon-btn" data-action="delete-custom" data-id="${esc(c.id)}" aria-label="Delete card">${icons.trash}</button></li>`).join('')}
    </ul>`;
}

function deckHTML() {
  const g = app.game;
  const s = g ? g.settings : app.setup.settings;
  const counts = g
    ? (id) => {
        const left = g.mode === 'duo' ? g.piles.all.filter((cid) => G.getCard(g, cid)?.set === id).length : g.piles[id]?.length ?? 0;
        return s.sets.includes(id) ? `${left} left` : `${setCounts(id)} cards`;
      }
    : undefined;
  return `
    <header class="dlg__head"><h2>Deck &amp; filters</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></header>
    <div class="dlg__body">
      <div class="field"><span class="field__label">Sets</span><div class="set-grid set-grid--compact">${setTiles(s.sets, { counts })}</div></div>
      <div class="field"><span class="field__label">Card types</span><div class="chips">${typeToggles(s.types)}</div></div>
      ${g?.mode === 'group' ? `
        <div class="field field--row"><span class="field__label">Cards to win</span>${stepper('deck-target', s.target, 'Cards to win', { min: 1, max: 20 })}</div>
        <div class="field field--row"><span class="field__label">Draw 2, pick 1</span>
          <button type="button" class="switch${s.drawTwo ? ' is-on' : ''}" data-action="deck-draw-two" role="switch" aria-checked="${s.drawTwo}"><span></span></button></div>` : ''}
      ${g?.mode === 'duo' ? `<div class="field field--row"><span class="field__label">Cards per round</span>${stepper('deck-round', s.roundSize, 'Cards per round', { min: 1, max: 50 })}</div>` : ''}
      ${g ? `<div class="deck-reshuffle">
        <p><b>${G.remaining(g)}</b> cards left · <b>${g.used.length}</b> drawn. Drawn cards won’t come back until you reshuffle.</p>
        <button type="button" class="btn btn--light" data-action="reshuffle">${icons.shuffle} Reshuffle all</button>
      </div>` : ''}
    </div>`;
}

function menuHTML() {
  const g = app.game;
  if (!g) return '';
  const canEditRoster = g.mode === 'group' && g.turn.phase === 'draw';
  return `
    <header class="dlg__head"><h2>Game menu</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></header>
    <div class="dlg__body">
      <h3 class="mini-title">Players</h3>
      <ul class="roster">
        ${g.players.map((p) => `<li>
          <input type="text" value="${esc(p.name)}" maxlength="24" data-bind="rename" data-pid="${p.id}" aria-label="Rename ${esc(p.name)}">
          ${g.mode === 'group' ? `<button type="button" class="icon-btn" data-action="remove-player" data-pid="${p.id}" ${canEditRoster && g.players.length > 3 ? '' : 'disabled'} aria-label="Remove ${esc(p.name)}">${icons.trash}</button>` : ''}
        </li>`).join('')}
      </ul>
      ${g.mode === 'group'
        ? `<form class="add-player" id="add-player-form"><input type="text" name="name" maxlength="24" placeholder="Add a player" ${canEditRoster ? '' : 'disabled'} aria-label="New player name"><button type="submit" class="btn btn--light btn--sm" ${canEditRoster ? '' : 'disabled'}>${icons.plus} Add</button></form>
           ${canEditRoster ? '' : '<p class="hint">Players can be added or removed between turns.</p>'}`
        : '<p class="hint">Head-to-head game. To play the group rules, start a new game with 3+ players.</p>'}
      <div class="menu-btns">
        <button type="button" class="btn btn--light" data-action="undo" ${app.undo.length ? '' : 'disabled'}>${icons.undo} Undo last action</button>
        <button type="button" class="btn btn--light" data-action="reshuffle">${icons.shuffle} Reshuffle deck</button>
        <button type="button" class="btn btn--light" data-action="restart">Rematch — same players</button>
        <button type="button" class="btn btn--danger" data-action="end-game">End game &amp; edit players</button>
      </div>
      ${g.log.length ? `<h3 class="mini-title">Recent</h3><ol class="log">${g.log.slice(0, 12).map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>` : ''}
    </div>`;
}

function winnerHTML() {
  const g = app.game;
  const w = g && G.player(g, g.winnerId);
  if (!w) return '';
  const ranked = [...g.players].sort((a, b) => b.points.length - a.points.length || a.drinks - b.drinks);
  return `
    <div class="dlg__body winner">
      <div class="winner__icon">${icons.cheers}</div>
      <p class="eyebrow">We have a winner</p>
      <h2>${esc(w.name)}</h2>
      <p class="winner__sub">collected ${plural(w.points.length, 'question card')}. <b>Make a toast to the truth!</b></p>
      <ol class="ranking">${ranked.map((p) => `<li><span>${esc(p.name)}</span><span>${plural(p.points.length, 'card')} · ${plural(p.drinks, 'drink')}</span></li>`).join('')}</ol>
      <div class="dlg__actions">
        <button type="button" class="btn btn--light" data-close>Keep playing</button>
        <button type="button" class="btn btn--primary" data-action="restart">Rematch</button>
      </div>
    </div>`;
}

const dialogs = {
  rules: () => rulesHTML(),
  custom: () => customHTML(),
  deck: () => deckHTML(),
  menu: () => menuHTML(),
  win: () => winnerHTML(),
};

function openDialog(name) {
  const d = $(`#dlg-${name}`);
  if (!d) return;
  d.innerHTML = dialogs[name]();
  if (!d.open) d.showModal();
  if (name === 'custom') d.querySelector('textarea')?.focus();
}

/** Re-render dialogs that show live state (deck, menu) if they are open. */
function refreshOpenDialogs() {
  for (const name of ['deck', 'menu']) {
    const d = $(`#dlg-${name}`);
    if (d?.open) {
      const focusedBind = document.activeElement?.closest?.(`#dlg-${name}`) ? document.activeElement.dataset?.pid : null;
      d.innerHTML = dialogs[name]();
      if (focusedBind) d.querySelector(`[data-pid="${focusedBind}"][data-bind]`)?.focus();
    }
  }
  const lib = $('#library');
  if (lib) lib.innerHTML = libraryHTML();
}

// ───────────────────────── render ─────────────────────────

function render() {
  const root = $('#app');
  const g = app.game;
  document.body.classList.toggle('in-game', !!g);
  $('#btn-undo').hidden = !g;
  $('#btn-undo').disabled = !app.undo.length;
  $('#btn-menu').hidden = !g;
  root.innerHTML = g ? gameView(g) : setupView();
  refreshOpenDialogs();
  if (g?.winnerId && !g.winnerSeen) {
    g.winnerSeen = true;
    persist();
    openDialog('win');
  }
}

// ───────────────────────── setup actions ─────────────────────────

/** Setup settings for `n` players: serving suggestions unless the user overrode them. */
function effectiveSettings(n) {
  const s = app.setup.settings;
  return app.setup.servingLocked ? { ...s } : G.applyServing(s, Math.max(3, n));
}

function startGame(names) {
  const settings = effectiveSettings(names.length);
  app.game = G.createGame(names, settings, app.library);
  app.undo = [];
  app.lastAnimated = null;
  persist();
  render();
  window.scrollTo({ top: 0 });
}

function toggleIn(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

// ───────────────────────── events ─────────────────────────

const handlers = {
  open: (el) => openDialog(el.dataset.dlg),

  // setup
  'add-name': () => {
    app.setup.names.push('');
    app.setup.servingLocked = false;
    persist();
    render();
    const inputs = document.querySelectorAll('[data-bind="name"]');
    inputs[inputs.length - 1]?.focus();
  },
  'remove-name': (el) => {
    app.setup.names.splice(Number(el.dataset.i), 1);
    app.setup.servingLocked = false;
    persist();
    render();
  },
  'move-name': (el) => {
    const i = Number(el.dataset.i);
    const n = app.setup.names;
    [n[i - 1], n[i]] = [n[i], n[i - 1]];
    persist();
    render();
  },
  'toggle-set': (el) => {
    const id = el.dataset.set;
    if (app.game) {
      const next = toggleIn(app.game.settings.sets, id);
      if (!next.length) return;
      act((g) => G.updateSettings(g, { sets: next }));
    } else {
      app.setup.settings.sets = toggleIn(app.setup.settings.sets, id);
      persist();
      render();
    }
  },
  'toggle-type': (el) => {
    const id = el.dataset.type;
    if (app.game) {
      const next = toggleIn(app.game.settings.types, id);
      if (!next.length) return;
      act((g) => G.updateSettings(g, { types: TYPE_IDS.filter((t) => next.includes(t)) }));
    } else {
      app.setup.settings.types = TYPE_IDS.filter((t) => toggleIn(app.setup.settings.types, id).includes(t));
      persist();
      render();
    }
  },
  'setup-target': (el) => setupNum('target', el, 1, 20),
  'setup-buy': (el) => setupNum('buyEach', el, 0, 9),
  'setup-round': (el) => setupNum('roundSize', el, 1, 50),
  'setup-buy-all': () => { lockServing(); app.setup.settings.buyEach = 'all'; persist(); render(); },
  'setup-buy-fixed': () => { lockServing(); app.setup.settings.buyEach = 2; persist(); render(); },
  'setup-draw-two': () => { app.setup.settings.drawTwo = !app.setup.settings.drawTwo; persist(); render(); },
  'quick-count': (el) => {
    app.setup.quickCount = Math.min(20, Math.max(2, app.setup.quickCount + Number(el.dataset.delta)));
    persist();
    render();
  },
  quick: () => startGame(Array.from({ length: app.setup.quickCount }, (_, i) => `Player ${i + 1}`)),
  start: () => {
    const names = app.setup.names.map((n) => n.trim()).filter(Boolean);
    if (names.length >= 2) startGame(names);
  },

  // game
  draw: (el) => {
    act((g) => G.draw(g, el.dataset.stack));
    navigator.vibrate?.(12);
  },
  pick: (el) => act((g) => G.pick(g, el.dataset.id)),
  answer: (el) => act((g) => G.answer(g, el.dataset.pid, el.dataset.result)),
  favorite: (el) => act((g) => G.chooseFavorite(g, el.dataset.pid)),
  'only-one': () => act((g) => G.onlyOne(g)),
  nobody: () => act((g) => G.nobodyAnswered(g)),
  'toggle-buy': () => { app.ui.buyOpen = !app.ui.buyOpen; render(); },
  buy: (el) => act((g) => G.buyARound(g, el.dataset.pid)),
  'next-round': () => act((g) => G.nextRound(g)),
  reshuffle: () => act((g) => G.reshuffle(g)),
  undo: () => undo(),
  'deck-target': (el) => act((g) => G.updateSettings(g, { target: clamp(g.settings.target + Number(el.dataset.delta), 1, 20) })),
  'deck-round': (el) =>
    act((g) => {
      const roundSize = clamp(g.settings.roundSize + Number(el.dataset.delta), 1, 50);
      g.roundLeft = Math.max(0, g.roundLeft + (roundSize - g.settings.roundSize));
      G.updateSettings(g, { roundSize });
    }),
  'deck-draw-two': () => act((g) => G.updateSettings(g, { drawTwo: !g.settings.drawTwo })),
  'remove-player': (el) => {
    const p = G.player(app.game, el.dataset.pid);
    if (p && window.confirm(`Remove ${p.name} from the game?`)) act((g) => G.removePlayer(g, el.dataset.pid));
  },
  restart: () => {
    const g = app.game;
    if (!g) return;
    $('#dlg-win')?.close();
    $('#dlg-menu')?.close();
    const names = g.players.map((p) => p.name);
    app.game = G.createGame(names, { ...g.settings }, app.library);
    app.undo = [];
    app.lastAnimated = null;
    persist();
    render();
  },
  'end-game': () => {
    const g = app.game;
    if (!g || !window.confirm('End this game? Scores will be cleared.')) return;
    app.setup.names = g.players.map((p) => p.name);
    app.setup.settings = { ...app.setup.settings, ...g.settings };
    app.game = null;
    app.undo = [];
    $('#dlg-menu')?.close();
    persist();
    render();
  },
  'delete-custom': (el) => {
    const id = el.dataset.id;
    app.library = app.library.filter((c) => c.id !== id);
    if (app.game) act((g) => G.removeCustomCard(g, id));
    else { persist(); render(); }
    refreshOpenDialogs();
  },
};

function lockServing() {
  app.setup.settings = effectiveSettings(app.setup.names.filter((x) => x.trim()).length);
  app.setup.servingLocked = true;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function setupNum(key, el, lo, hi) {
  if (key === 'target' || key === 'buyEach') {
    const filled = app.setup.names.filter((x) => x.trim()).length;
    app.setup.settings = effectiveSettings(filled);
    app.setup.servingLocked = true;
  }
  const cur = Number(app.setup.settings[key]) || 0;
  app.setup.settings[key] = clamp(cur + Number(el.dataset.delta), lo, hi);
  persist();
  render();
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) {
    closer.closest('dialog')?.close();
    return;
  }
  // click on the dialog backdrop closes it
  if (e.target instanceof HTMLDialogElement) {
    const r = e.target.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) e.target.close();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  handlers[el.dataset.action]?.(el, e);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset?.bind === 'name') {
    app.setup.names[Number(el.dataset.i)] = el.value;
    save('setup', app.setup);
    const n = app.setup.names.filter((x) => x.trim()).length;
    const summary = $('#mode-summary');
    if (summary) summary.innerHTML = modeSummary(n, effectiveSettings(n));
    const start = $('[data-action="start"]');
    if (start) {
      start.disabled = n < 2 || setupProblems(app.setup.settings).length > 0;
      start.textContent = `Start game${n >= 2 ? ` · ${n} players` : ''}`;
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.bind === 'rename' && app.game) {
    const name = el.value.trim();
    if (!name) { el.value = G.player(app.game, el.dataset.pid)?.name ?? ''; return; }
    act((g) => G.renamePlayer(g, el.dataset.pid, name));
  }
});

document.addEventListener('keydown', (e) => {
  // Enter in a setup name field jumps to the next field (or adds one).
  if (e.key === 'Enter' && e.target.dataset?.bind === 'name') {
    e.preventDefault();
    const i = Number(e.target.dataset.i);
    const next = document.querySelector(`[data-bind="name"][data-i="${i + 1}"]`);
    if (next) next.focus();
    else handlers['add-name']();
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'custom-form') {
    e.preventDefault();
    const data = new FormData(form);
    const msg = $('#custom-msg');
    let card;
    try {
      card = G.makeCustomCard({ text: data.get('text'), set: data.get('set'), type: data.get('type') });
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg is-error';
      return;
    }
    app.library.unshift(card);
    if (app.game) {
      const playNext = data.get('next') === 'on';
      act((g) => G.addCustomCard(g, card, { playNext }));
      msg.textContent = playNext ? 'Added — it’s on top of the stack.' : 'Added and shuffled in.';
    } else {
      if (!app.setup.settings.sets.includes(card.set)) app.setup.settings.sets.push(card.set);
      persist();
      render();
      msg.textContent = 'Added — it will be shuffled into your next game.';
    }
    msg.className = 'form-msg is-ok';
    form.elements.text.value = '';
    form.elements.text.focus();
    refreshOpenDialogs();
  } else if (form.id === 'add-player-form') {
    e.preventDefault();
    const name = new FormData(form).get('name');
    act((g) => G.addPlayer(g, name));
  }
});

// Top bar buttons
$('#btn-rules').addEventListener('click', () => openDialog('rules'));
$('#btn-custom').addEventListener('click', () => openDialog('custom'));
$('#btn-deck').addEventListener('click', () => openDialog('deck'));
$('#btn-menu').addEventListener('click', () => openDialog('menu'));
$('#btn-undo').addEventListener('click', () => undo());
$('#home-link').addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
});

render();
