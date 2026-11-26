// The Attack on Titan arc diagram (writing/aot.html, at /writing/aot). Every episode sits along one line, as wide as it
// is long, grouped by season; each connection is an arc from the moment in one episode to the moment it links
// to. The farther apart the two moments are, the higher the arc. Hover an arc (or tap it) to read the note,
// hover an episode to light up everything that touches it, click to pin a note below the chart.
// Data: assets/aot/connections.json (real) and sample-connections.json (made-up filler).
// Source for build/arcs.js: rebuild with `npm run build` after editing.

const BASE = '/assets/aot/';
const NS = 'http://www.w3.org/2000/svg';

// ---- the episodes ----
// Global numbering 1-89: the 87 TV episodes, then the two Final Chapters specials. Runtimes in minutes.
const PARTS = [
  { short: 'S1', name: 'Season 1', season: 1, offset: 0, count: 25 },
  { short: 'S2', name: 'Season 2', season: 2, offset: 0, count: 12 },
  { short: 'S3·1', name: 'Season 3 Part 1', season: 3, offset: 0, count: 12 },
  { short: 'S3·2', name: 'Season 3 Part 2', season: 3, offset: 12, count: 10 },
  { short: 'S4·1', name: 'Final Season Part 1', season: 4, offset: 0, count: 16 },
  { short: 'S4·2', name: 'Final Season Part 2', season: 4, offset: 16, count: 12 },
  { short: 'FC', name: 'The Final Chapters', special: true, count: 2, runtimes: [61, 85] },
];
const EPS = [];
PARTS.forEach((p, pi) => {
  for (let i = 0; i < p.count; i++) {
    EPS.push({
      n: EPS.length + 1, part: pi,
      label: p.special ? `Final Chapters ${i + 1}` : `S${p.season} E${p.offset + i + 1}`,
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

// a tiny seeded random, so the sample arcs come out the same on every load
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
}
function makeSamples({ count, seed }, types) {
  const r = rng(seed), names = Object.keys(types), out = [];
  for (let i = 0; i < count; i++) {
    // most start in what's been logged so far (episodes 1-10) and reach forward, like the real notes will
    const a = r() < .7 ? 1 + Math.floor(r() * 10) : 1 + Math.floor(r() * 80);
    const far = r() < .55;
    const b = Math.min(EPS.length, Math.max(1, far ? 30 + Math.floor(r() * 59) : a + Math.floor(r() * 14) - 2));
    if (a === b) continue;
    const t = () => `${Math.floor(r() * 22) + 1}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
    out.push({
      id: `sample-${i}`, sample: true,
      from: { ep: Math.min(a, b), t: t() }, to: { ep: Math.max(a, b), t: t() },
      type: names[Math.floor(r() * names.length)], characters: [],
      note: 'Sample arc, a placeholder for the layout only. A real note goes here.',
    });
  }
  return out;
}

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
const state = { colour: 'distance', samples: true, upTo: PARTS.length - 1, hidden: new Set(), pinned: null, hoverEp: null };
let meta, real = [], samples = [];

const root = document.getElementById('arcs');
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('class', 'arc-svg');
svg.setAttribute('role', 'img');
svg.setAttribute('aria-label', 'Arc diagram of connections between Attack on Titan episodes');
root.querySelector('.chart').append(svg);
const tip = root.querySelector('.arc-tip');
const card = root.querySelector('.arc-card');
const stats = root.querySelector('.arc-stats');

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
};

const visible = () => {
  const lastEp = EPS.findLast((e) => e.part <= state.upTo).n;
  return [...real, ...(state.samples ? samples : [])]
    .filter((c) => c.to.ep <= lastEp && c.from.ep <= lastEp && !state.hidden.has(c.type));
};

// ---- layout + draw ----
let geo = null;
function draw() {
  const W = root.querySelector('.chart').clientWidth;
  const narrow = W < 560;
  const padX = 4, epGap = W < 700 ? .5 : 1, partGap = narrow ? 5 : 10;
  const arcH = Math.round(Math.min(360, Math.max(150, W * .36)));
  const barH = narrow ? 12 : 16, labelH = 30;
  const H = arcH + 14 + barH + labelH;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.replaceChildren();

  // episode x positions, widths in proportion to runtime
  const totalMins = EPS.reduce((s, e) => s + e.mins, 0);
  const free = W - padX * 2 - partGap * (PARTS.length - 1) - epGap * (EPS.length - PARTS.length);
  const perMin = free / totalMins;
  let x = padX;
  const xs = EPS.map((e, i) => {
    if (i && EPS[i - 1].part !== e.part) x += partGap - epGap;
    const at = { x, w: e.mins * perMin };
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

  const lastEp = EPS.findLast((e) => e.part <= state.upTo).n;

  // the arcs: one visible path and one wide invisible one to catch the pointer
  const arcsG = el('g', { class: 'arcs' }, svg);
  const hitsG = el('g', { class: 'hits' }, svg);
  const list = visible().map((c) => ({ c, x1: posOf(c.from), x2: posOf(c.to) }))
    .sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1));     // long arcs underneath, short ones on top
  for (const { c, x1, x2 } of list) {
    const rx = Math.max(.5, (x2 - x1) / 2), ry = Math.min(arcH - 4, rx * (arcH - 4) / (plotW / 2));
    const d = `M${x1.toFixed(1)} ${y0} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y0}`;
    const colour = state.colour === 'type' ? (meta.types[c.type] || '#2d3a68') : ramp((x2 - x1) / plotW);
    const p = el('path', { d, stroke: colour, class: `arc${c.sample ? ' sample' : ''}` }, arcsG);
    p.dataset.id = c.id;
    const h = el('path', { d, class: 'hit', tabindex: 0, role: 'button', 'aria-label': `${ep(c.from.ep).label} to ${ep(c.to.ep).label}` }, hitsG);
    h.dataset.id = c.id;
    c._path = p;
  }

  // the episodes
  const epsG = el('g', { class: 'eps' }, svg);
  EPS.forEach((e, i) => {
    const g = xs[i];
    const cls = ['ep', e.n <= meta.loggedThrough ? 'logged' : '', e.n > lastEp ? 'hidden-ep' : ''].join(' ').trim();
    const r = el('rect', { x: g.x.toFixed(1), y: y0, width: Math.max(.8, g.w).toFixed(1), height: barH, rx: 1, class: cls }, epsG);
    r.dataset.ep = e.n;
  });
  // season labels and their brackets
  PARTS.forEach((p, pi) => {
    const idx = EPS.filter((e) => e.part === pi).map((e) => e.n - 1);
    const a = xs[idx[0]].x, b = xs[idx.at(-1)].x + xs[idx.at(-1)].w;
    el('path', { d: `M${a} ${y0 + barH + 6} v4 H${b} v-4`, class: 'bracket' }, svg);
    const t = el('text', { x: (a + b) / 2, y: y0 + barH + 24, class: `part-label${pi > state.upTo ? ' hidden-ep' : ''}`, 'text-anchor': 'middle' }, svg);
    t.textContent = narrow ? p.short : p.name.replace('Final Season', 'S4').replace('Season ', 'S').replace(' Part ', ' · ').replace('The Final Chapters', 'Final Ch.');
  });

  // the "logged so far" marker: a little flag at the end of the logged episodes
  const lx = xs[meta.loggedThrough - 1].x + xs[meta.loggedThrough - 1].w;
  el('line', { x1: lx, x2: lx, y1: y0 - 6, y2: y0 + barH + 2, class: 'logged-mark' }, svg);

  const shown = list.length, realShown = list.filter((a) => !a.c.sample).length;
  stats.textContent = `${realShown} real connection${realShown === 1 ? '' : 's'}${state.samples ? ` + ${shown - realShown} samples` : ''} · rewatch #${meta.rewatch} · logged through episode ${meta.loggedThrough} of ${EPS.length}`;
  paint();
}

// ---- highlight ----
let hoverArc = null;
function paint() {
  const focus = hoverArc || state.pinned;
  const touching = state.hoverEp;
  let any = false;
  for (const c of [...real, ...samples]) {
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
const byId = (id) => real.find((c) => c.id === id) || samples.find((c) => c.id === id);

const where = (end) => `${ep(end.ep).label}${end.t ? ` · ${end.t}` : ''}`;
function describe(c) {
  return `
    <div class="arc-route"><span>${where(c.from)}</span><span class="arrow">→</span><span>${where(c.to)}</span></div>
    <div class="arc-tags">
      <span class="tag" style="--tag:${meta.types[c.type] || '#2d3a68'}">${c.type}</span>
      ${c.characters.map((n) => `<span class="tag char">${n}</span>`).join('')}
      ${c.sample ? '<span class="tag sample">sample</span>' : ''}
    </div>
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
  card.innerHTML = c ? describe(c) : '<p class="arc-hint">Hover an arc to read it, or click one to pin it here.</p>';
  card.classList.toggle('has', !!c);
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
    showTip(`<div class="arc-route"><span>${ep(state.hoverEp).label}</span></div><p class="arc-note muted">episode ${state.hoverEp} · ${n} connection${n === 1 ? '' : 's'}</p>`, e);
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

// ---- controls ----
function controls() {
  const colourBtns = root.querySelectorAll('[data-colour]');
  colourBtns.forEach((b) => b.addEventListener('click', () => {
    state.colour = b.dataset.colour;
    colourBtns.forEach((o) => o.setAttribute('aria-pressed', o === b));
    legend();
    draw();
  }));

  const sel = root.querySelector('#upto');
  PARTS.forEach((p, i) => sel.append(new Option(i === PARTS.length - 1 ? 'everything' : `up to ${p.name}`, i)));
  sel.value = state.upTo;
  sel.addEventListener('change', () => { state.upTo = +sel.value; pin(null); draw(); });

  const sm = root.querySelector('#samples');
  sm.checked = state.samples;
  sm.addEventListener('change', () => { state.samples = sm.checked; pin(null); draw(); });
  legend();
}

function legend() {
  const box = root.querySelector('.legend');
  if (state.colour === 'distance') {
    box.innerHTML = `<span class="ramp-label">near</span><span class="ramp" style="background:linear-gradient(90deg,${RAMP.join(',')})"></span><span class="ramp-label">far</span>`;
    return;
  }
  box.replaceChildren(...Object.entries(meta.types).map(([name, colour]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'type-key';
    b.style.setProperty('--tag', colour);
    b.setAttribute('aria-pressed', !state.hidden.has(name));
    b.innerHTML = `<span class="swatch"></span>${name}`;
    b.addEventListener('click', () => {
      state.hidden.has(name) ? state.hidden.delete(name) : state.hidden.add(name);
      b.setAttribute('aria-pressed', !state.hidden.has(name));
      pin(null);
      draw();
    });
    return b;
  }));
}

// ---- start ----
(async () => {
  const [data, sample] = await Promise.all([
    fetch(BASE + 'connections.json').then((r) => r.json()),
    fetch(BASE + 'sample-connections.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  meta = data;
  real = data.connections;
  samples = sample ? makeSamples(sample, data.types) : [];
  if (!samples.length) root.querySelector('.sample-toggle').hidden = true;
  controls();
  pin(null);
  draw();
  new ResizeObserver(() => draw()).observe(root.querySelector('.chart'));
})();
