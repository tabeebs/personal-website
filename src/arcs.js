// The Attack on Titan arc diagram (writing/aot.html, at /writing/aot). Every episode sits along one line, as wide as it
// is long, grouped by season; each connection is an arc from the moment in one episode to the moment it links
// to. The farther apart the two moments are, the higher the arc. Hover an arc (or tap it) to read the note,
// click to pin a note below the chart. Hover an episode to light up its arcs.
// Data: assets/aot/connections.json.
// Source for build/arcs.js: rebuild with `npm run build` after editing.

const BASE = '/assets/aot/';
const NS = 'http://www.w3.org/2000/svg';

// ---- the episodes ----
// Global numbering 1-89: the 87 TV episodes, then the two Final Chapters specials, labelled "Movies". Runtimes in minutes.
const PARTS = [
// Labels, full then short: the season labels under the chart all use full names when they fit, else all short ones.
  { names: ['Season 1', 'S1'], season: 1, offset: 0, count: 25 },
  { names: ['Season 2', 'S2'], season: 2, offset: 0, count: 12 },
  { names: ['Season 3 Part 1', 'S3 P1'], season: 3, offset: 0, count: 12 },
  { names: ['Season 3 Part 2', 'S3 P2'], season: 3, offset: 12, count: 10 },
  { names: ['Season 4 Part 1', 'S4 P1'], season: 4, offset: 0, count: 16 },
  { names: ['Season 4 Part 2', 'S4 P2'], season: 4, offset: 16, count: 12 },
  { names: ['Movies', 'Movies'], special: true, count: 2, runtimes: [61, 85] },
];
const EPS = [];
PARTS.forEach((p, pi) => {
  for (let i = 0; i < p.count; i++) {
    EPS.push({
      n: EPS.length + 1, part: pi,
      label: p.special ? `Movie ${i + 1}` : `S${p.season} E${p.offset + i + 1}`,
      mins: p.runtimes ? p.runtimes[i] : 24,
    });
  }
});
const ep = (n) => EPS[n - 1];

const toMins = (t) => {
  if (t == null || t === '') return null;
  const [m, s = 0] = String(t).split(':').map(Number);
  return m + s / 60;
};

// ---- colour ----
// by distance: short reaches are teal, the longest are tomato, through blue and lilac
const RAMP = ['#25a088', '#2f6cbc', '#7f71d4', '#d8689c', '#dc4c36'];
function mix(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}
function ramp(k) {
  const f = Math.min(.9999, Math.max(0, k)) * (RAMP.length - 1), i = Math.floor(f);
  return mix(RAMP[i], RAMP[i + 1], f - i);
}

// ---- state ----
const state = { pinned: null, hoverEp: null };
let meta, real = [];

const root = document.getElementById('arcs');
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('class', 'arc-svg');
svg.setAttribute('role', 'img');
svg.setAttribute('aria-label', 'Arc diagram of connections between Attack on Titan episodes');
root.querySelector('.chart').append(svg);
const tip = root.querySelector('.arc-tip');
const card = root.querySelector('.arc-card');

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
};

const visible = () => real;

// ---- layout + draw ----
let geo = null;
function draw() {
  const W = root.querySelector('.chart').clientWidth;
  const narrow = W < 560;
  const epGap = W < 700 ? .5 : 1, partGap = narrow ? 5 : 10;
  const arcH = Math.round(Math.min(470, Math.max(170, W * .42)));
  const barH = narrow ? 12 : 16, labelH = 50;
  const H = arcH + 14 + barH + labelH;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.replaceChildren();

  // Side margins, the same on both sides so the chart stays centred: enough that the last label ("Movies",
  // under only two episodes) can sit centred under them without running off the edge.
  const probe = el('text', { class: 'part-label' }, svg);
  probe.textContent = PARTS.at(-1).names[narrow ? 1 : 0];
  const lastW = probe.getComputedTextLength();
  probe.remove();
  const unitGuess = (W - partGap * (PARTS.length - 1)) / EPS.length;
  const padX = Math.max(4, Math.ceil(lastW / 2 - unitGuess * PARTS.at(-1).count / 2) + 2);
  root.style.setProperty('--pad', `${padX}px`);   // the key lines up with the ends of the episodes

  // episode x positions: every episode the same width (a timestamp still lands in proportion within its episode)
  const free = W - padX * 2 - partGap * (PARTS.length - 1) - epGap * (EPS.length - PARTS.length);
  const unit = free / EPS.length;
  let x = padX;
  const xs = EPS.map((e, i) => {
    if (i && EPS[i - 1].part !== e.part) x += partGap - epGap;
    const at = { x, w: unit };
    x += at.w + epGap;
    return at;
  });
  const y0 = arcH + 10;
  const plotW = W - padX * 2;
  const posOf = (end) => {
    const e = ep(end.ep), g = xs[end.ep - 1], m = toMins(end.t);
    return g.x + g.w * (m == null ? .5 : Math.min(1, m / e.mins));
  };
  geo = { xs, y0, barH };

  // the arcs: one visible path and one wide invisible one to catch the pointer
  const arcsG = el('g', { class: 'arcs' }, svg);
  const hitsG = el('g', { class: 'hits' }, svg);
  const list = visible().map((c) => ({ c, x1: posOf(c.from), x2: posOf(c.to) }))
    .sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1));     // long arcs underneath, short ones on top
  for (const { c, x1, x2 } of list) {
    const rx = Math.max(.5, (x2 - x1) / 2), ry = Math.min(arcH - 4, rx * (arcH - 4) / (plotW / 2));
    const d = `M${x1.toFixed(1)} ${y0} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y0}`;
    const p = el('path', { d, stroke: ramp((x2 - x1) / plotW), class: 'arc' }, arcsG);
    p.dataset.id = c.id;
    const h = el('path', { d, class: 'hit', tabindex: 0, role: 'button', 'aria-label': `${ep(c.from.ep).label} to ${ep(c.to.ep).label}` }, hitsG);
    h.dataset.id = c.id;
    c._path = p;
  }

  // the episodes
  const epsG = el('g', { class: 'eps' }, svg);
  EPS.forEach((e, i) => {
    const g = xs[i];
    const r = el('rect', { x: g.x.toFixed(1), y: y0, width: Math.max(.8, g.w).toFixed(1), height: barH, rx: 1, class: 'ep' }, epsG);
    r.dataset.ep = e.n;
  });
  // season labels, each centred under its bracket, all on one line if they fit (full names, else short ones). Only
  // if even the short ones would touch does the later of two drop to a second line, still centred, with a thin tick.
  const ly = y0 + barH + 25, GAP = 12;
  const spans = PARTS.map((p, pi) => {
    const idx = EPS.filter((e) => e.part === pi).map((e) => e.n - 1);
    const a = xs[idx[0]].x, b = xs[idx.at(-1)].x + xs[idx.at(-1)].w;
    el('path', { d: `M${a} ${y0 + barH + 6} v4 H${b} v-4`, class: 'bracket' }, svg);
    return { c: (a + b) / 2, t: el('text', { x: ((a + b) / 2).toFixed(1), y: ly, class: 'part-label', 'text-anchor': 'middle' }, svg) };
  });
  // first choice full names on one line, then short names on one line, then short names over two lines
  for (const [level, rows] of [[0, 1], [1, 1], [1, 2]]) {
    const rowEnd = [-Infinity, rows > 1 ? -Infinity : Infinity];
    const ok = spans.every((sp, i) => {
      sp.t.textContent = PARTS[i].names[Math.min(level, PARTS[i].names.length - 1)];
      const w = sp.t.getComputedTextLength(), l = sp.c - w / 2;
      sp.row = l >= rowEnd[0] + GAP ? 0 : l >= rowEnd[1] + GAP ? 1 : -1;
      if (sp.row < 0) return false;
      rowEnd[sp.row] = sp.c + w / 2;
      return true;
    });
    if (ok || rows > 1) break;
  }
  for (const sp of spans) {
    if (sp.row !== 1) continue;
    sp.t.setAttribute('y', ly + 17);
    el('line', { x1: sp.c, x2: sp.c, y1: y0 + barH + 11, y2: ly + 4, class: 'part-tick' }, svg);
  }

  paint();
}

// ---- highlight ----
let hoverArc = null;
function paint() {
  const focus = hoverArc || state.pinned;
  const touching = state.hoverEp;
  let any = false;
  for (const c of real) {
    const p = c._path;
    if (!p?.isConnected) continue;
    const on = focus ? c.id === focus : touching ? (c.from.ep === touching || c.to.ep === touching) : null;
    p.classList.toggle('on', on === true);
    p.classList.toggle('off', on === false);
    if (on) { any = true; p.parentNode.append(p); }   // bring it to the front
  }
  svg.classList.toggle('focused', any);
  svg.querySelectorAll('.ep').forEach((r) => {
    const n = +r.dataset.ep, c = focus && byId(focus);
    r.classList.toggle('lit', c ? (n === c.from.ep || n === c.to.ep) : n === touching);
  });
}
const byId = (id) => real.find((c) => c.id === id);

const where = (end) => `${ep(end.ep).label}${end.t ? ` · ${end.t}` : ''}`;
function describe(c) {
  return `
    <div class="arc-route"><span>${where(c.from)}</span><span class="arrow">→</span><span>${where(c.to)}</span></div>
    ${c.characters?.length ? `<div class="arc-tags">${c.characters.map((n) => `<span class="tag char">${n}</span>`).join('')}</div>` : ''}
    <p class="arc-note">${c.note}</p>
    ${c.check ? `<p class="arc-check">To do: ${c.check}</p>` : ''}`;
}

function showTip(html, e) {
  tip.innerHTML = html;
  tip.hidden = false;
  const box = root.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = e.clientX - box.left + 14, y = e.clientY - box.top - th - 12;
  if (x + tw > box.width) x = e.clientX - box.left - tw - 14;
  if (x < 0) x = Math.max(0, Math.min(box.width - tw, e.clientX - box.left - tw / 2));
  if (y < 0) y = e.clientY - box.top + 18;
  tip.style.transform = `translate(${x}px, ${y}px)`;
}
const hideTip = () => { tip.hidden = true; };

function pin(id) {
  state.pinned = id;
  const c = id && byId(id);
  card.innerHTML = c ? describe(c) : '';
  card.hidden = !c;
  paint();
}

svg.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const hit = e.target.closest('.hit'), bar = e.target.closest('.ep');
  if (hit) {
    hoverArc = hit.dataset.id; state.hoverEp = null;
    showTip(describe(byId(hoverArc)), e);
  } else if (bar) {
    hoverArc = null; state.hoverEp = +bar.dataset.ep;
    const n = visible().filter((c) => c.from.ep === state.hoverEp || c.to.ep === state.hoverEp).length;
    showTip(`<div class="arc-route"><span>${ep(state.hoverEp).label}</span></div><p class="arc-note">episode ${state.hoverEp} · ${n} connection${n === 1 ? '' : 's'}</p>`, e);
  } else {
    hoverArc = null; state.hoverEp = null; hideTip();
  }
  paint();
});
svg.addEventListener('pointerleave', () => { hoverArc = null; state.hoverEp = null; hideTip(); paint(); });
svg.addEventListener('click', (e) => {
  const hit = e.target.closest('.hit'), bar = e.target.closest('.ep');
  if (hit) pin(state.pinned === hit.dataset.id ? null : hit.dataset.id);
  else if (bar) { state.hoverEp = state.hoverEp === +bar.dataset.ep && e.pointerType !== 'mouse' ? null : +bar.dataset.ep; pin(null); }
  else { state.hoverEp = null; pin(null); }
});
svg.addEventListener('keydown', (e) => {
  const hit = e.target.closest('.hit');
  if (hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pin(hit.dataset.id); }
});
svg.addEventListener('focusin', (e) => { const hit = e.target.closest('.hit'); if (hit) { hoverArc = hit.dataset.id; paint(); } });
svg.addEventListener('focusout', () => { hoverArc = null; paint(); });

// ---- the key ----
// Under the chart, where the eye lands after reading it: a short low arc in the near colour, a tall wide one in the
// far colour, since both height and colour say how far apart the two moments are.
const keyArc = (w, h, colour) => `<svg class="key-arc" width="${w + 4}" height="${h + 3}" viewBox="0 0 ${w + 4} ${h + 3}" aria-hidden="true">
  <path d="M2 ${h + 2} A${w / 2} ${h} 0 0 1 ${w + 2} ${h + 2}" stroke="${colour}" /></svg>`;
root.querySelector('.arc-key').innerHTML = `
  <span class="key-item">${keyArc(12, 6, RAMP[0])}close together</span>
  <span class="key-item">${keyArc(30, 15, RAMP.at(-1))}far apart</span>`;

// ---- start ----
(async () => {
  meta = await fetch(BASE + 'connections.json').then((r) => r.json());
  real = meta.connections;
  pin(null);
  draw();
  new ResizeObserver(() => draw()).observe(root.querySelector('.chart'));
})();
