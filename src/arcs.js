// The Attack on Titan arc diagram (writing/aot.html, at /writing/aot). Every episode sits along one line, as wide as it
// is long, grouped by season; each connection is an arc from the moment in one episode to the moment it links
// to. The farther apart the two moments are, the higher the arc. Hover an arc (or tap it) to read the note,
// click to pin a note below the chart. Hover an episode and a card folds up out of it listing its connections.
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
// by distance: short reaches burn crimson, then orange, and the longest glow gold. They add up where they cross
// (screen blending, assets/aot/aot.css), so the busy stretches of the show glow brightest.
const RAMP = ['#c81d3a', '#f0532c', '#ff9a2e', '#ffd56b'];
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
  // as tall as the width suits, but short enough that the chart and the card under it fit on the screen together
  const roomH = innerHeight - (root.getBoundingClientRect().top + scrollY) - 14 - 16 - 50 - CARD_H - 24;
  const arcH = Math.round(Math.max(170, Math.min(470, W * .42, roomH)));
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

  placeCard();
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

// ---- the episode card ----
// Hover an episode and a card folds down out of it, one row per connection that touches it. Hovering a row lights its
// arc; clicking one grows it into the clip view (below).
// The card stays while the pointer travels from the episode up into it; clicking the episode (or anything in the
// card) keeps it open until you click elsewhere, press Escape or hit ×. On touch, a tap opens it.
const epCard = document.createElement('div');
epCard.className = 'ep-card';
epCard.hidden = true;
root.append(epCard);
const CARD_H = 236 + 12;                             // the episode card's height (aot.css) and its gap
const cardState = { n: null, pinned: false, closeT: 0, list: [] };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function rowHtml(c, n, i) {
  const out = c.from.ep === n && c.to.ep !== n;
  const other = out ? c.to : c.from;
  return `<li class="ep-row" style="--i:${i}" data-id="${c.id}" data-i="${i}">
    <button type="button" class="ep-row-head" aria-haspopup="dialog">
      <span class="ep-row-dir">${out ? 'leads to' : 'comes from'}</span>
      <span class="ep-row-where">${ep(other.ep).label}${other.t ? `<span class="ep-row-t"> · ${other.t}</span>` : ''}</span>
    </button>
  </li>`;
}

// ---- the clip view ----
// Click a row in the episode card and it grows into a big panel: the moment at each end of the connection as a
// looping clip, side by side, and the analysis underneath. ‹ › (or the arrow keys) step through the episode's other
// connections. A connection's clips and analysis live in connections.json:
//   "clips": [{ "src": "/assets/aot/clips/levi-disgusting.mp4", "at": "from", "caption": "…" }, { …, "at": "to" }],
//   "analysis": ["first paragraph", "second paragraph"]
// "at" says which end the clip shows; an .mp4/.webm plays like a GIF (muted, looping), a .gif/.webp shows as an image.
// Cut clips with `npm run clip` (scripts/clip.js).
const view = document.createElement('dialog');
view.className = 'clip-view';
document.body.append(view);
let viewAt = -1;

const isVideo = (src) => /\.(mp4|webm|mov)$/i.test(src);
function clipHtml(clip, end) {
  if (!clip) {
    return `<figure class="clip empty"><div class="clip-frame"><span>a clip from ${where(end)} goes here</span></div>
      <figcaption>${where(end)}</figcaption></figure>`;
  }
  const m = isVideo(clip.src)
    ? `<video src="${clip.src}" muted loop playsinline preload="auto" ${reduced.matches ? 'controls' : 'autoplay'}></video>`
    : `<img src="${clip.src}" alt="${clip.alt || clip.caption || ''}">`;
  return `<figure class="clip"><div class="clip-frame">${m}</div><figcaption>${clip.caption || where(end)}</figcaption></figure>`;
}

function viewHtml(c, i, total) {
  const clips = c.clips || [];
  const at = (k) => clips.filter((x) => x.at === k);
  const figs = ['from', 'to'].flatMap((k) => (at(k).length ? at(k).map((x) => clipHtml(x, c[k])) : [clipHtml(null, c[k])]))
    .concat(clips.filter((x) => x.at !== 'from' && x.at !== 'to').map((x) => clipHtml(x, c.from)));
  const analysis = [].concat(c.analysis || []).filter(Boolean);
  return `
    <header class="cv-head">
      <h3 class="cv-route"><span>${where(c.from)}</span><span class="arrow">→</span><span>${where(c.to)}</span></h3>
      <div class="cv-nav">
        <button type="button" data-go="-1" aria-label="Previous connection" ${i ? '' : 'disabled'}>‹</button>
        <span class="cv-count">${i + 1} / ${total}</span>
        <button type="button" data-go="1" aria-label="Next connection" ${i < total - 1 ? '' : 'disabled'}>›</button>
        <button type="button" class="cv-x" aria-label="Close">×</button>
      </div>
    </header>
    ${c.characters?.length ? `<div class="arc-tags cv-who">${c.characters.map((w) => `<span class="tag char">${w}</span>`).join('')}</div>` : ''}
    <div class="cv-media${figs.length === 1 ? ' one' : ''}">${figs.join('')}</div>
    <div class="cv-text">
      <p class="cv-lede">${c.note}</p>
      ${analysis.length ? analysis.map((p) => `<p>${p}</p>`).join('') : '<div class="cv-slot">the analysis goes here</div>'}
      ${c.check ? `<p class="arc-check">To do: ${c.check}</p>` : ''}
    </div>`;
}

function openClip(i, fromEl) {
  const list = cardState.list;
  if (!list?.[i]) return;
  viewAt = i;
  view.innerHTML = viewHtml(list[i], i, list.length);
  view.setAttribute('aria-label', `${where(list[i].from)} to ${where(list[i].to)}`);
  hoverArc = list[i].id; paint();
  if (!view.open) {
    view.showModal();
    if (fromEl && !reduced.matches) {               // grow out of the row that was clicked
      const a = fromEl.getBoundingClientRect(), b = view.getBoundingClientRect();
      view.animate([
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: .4 },
        { transform: 'none', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.2, .9, .25, 1)' });
    }
  }
  view.scrollTop = 0;
  view.querySelector('.cv-x').focus({ preventScroll: true });
}
function closeClip() {
  if (!view.open) return;
  const done = () => { view.close(); view.replaceChildren(); hoverArc = null; paint(); };
  if (reduced.matches) return done();
  view.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.98)' }],
    { duration: 170, easing: 'ease-in' }).onfinish = done;
}
view.addEventListener('cancel', (e) => { e.preventDefault(); closeClip(); });
view.addEventListener('click', (e) => {
  if (e.target === view) {                          // the backdrop (outside the panel) closes it
    const r = view.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeClip();
    return;
  }
  if (e.target.closest('.cv-x')) closeClip();
  const go = e.target.closest('[data-go]');
  if (go) openClip(viewAt + +go.dataset.go);
});
view.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && viewAt > 0) openClip(viewAt - 1);
  if (e.key === 'ArrowRight' && viewAt < cardState.list.length - 1) openClip(viewAt + 1);
});

function placeCard() {
  if (epCard.hidden || cardState.n == null) return;
  const g = geo.xs[cardState.n - 1], chart = root.querySelector('.chart');
  const cx = chart.offsetLeft + g.x + g.w / 2;
  // under the episode, so the arcs it lights up above stay in full view
  const top = chart.offsetTop + geo.y0 + geo.barH + 9;
  const w = epCard.offsetWidth;
  const left = Math.max(0, Math.min(root.clientWidth - w, cx - w / 2));
  epCard.style.left = `${left}px`;
  epCard.style.top = `${top}px`;
  epCard.style.setProperty('--px', `${cx - left}px`);
}

function openEp(n, pinIt = false) {
  clearTimeout(cardState.closeT);
  if (pinIt) cardState.pinned = true;
  if (cardState.n === n && !epCard.hidden) return;
  const fresh = epCard.hidden || epCard.classList.contains('closing');
  cardState.n = n; state.hoverEp = n; hoverArc = null; hideTip();
  const at = (c) => { const o = c.from.ep === n ? c.to : c.from; return o.ep * 100 + (toMins(o.t) ?? 0); };
  const list = visible().filter((c) => c.from.ep === n || c.to.ep === n).sort((a, b) => at(a) - at(b));
  cardState.list = list;
  epCard.innerHTML = `
    <div class="ep-card-head">
      <div class="ep-card-title"><span class="name">${ep(n).label}</span></div>
      <div class="ep-card-end"><span class="overall">(${n}/${EPS.length})</span>
        <button type="button" class="ep-card-x" aria-label="Close"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg></button></div>
    </div>
    ${list.length ? `<ol class="ep-rows">${list.map((c, i) => rowHtml(c, n, i)).join('')}</ol>`
      : `<p class="ep-empty">No connections yet.</p>`}`;
  epCard.hidden = false;
  epCard.classList.remove('closing');
  if (fresh) { epCard.classList.remove('unfold'); void epCard.offsetWidth; epCard.classList.add('unfold'); }
  placeCard();
  paint();
}

function closeEp(now = false) {
  clearTimeout(cardState.closeT);
  if (epCard.hidden) return;
  cardState.n = null; cardState.pinned = false; state.hoverEp = null; hoverArc = null;
  paint();
  if (now || reduced.matches) { epCard.hidden = true; epCard.classList.remove('unfold', 'closing'); return; }
  epCard.classList.add('closing');
  cardState.closeT = setTimeout(folded, 400);     // in case animationend never comes (a background tab)
}
function folded() {
  if (!epCard.classList.contains('closing')) return;
  epCard.hidden = true;
  epCard.classList.remove('unfold', 'closing');
}
epCard.addEventListener('animationend', (e) => { if (e.target === epCard) folded(); });
// a beat before closing, so the pointer can get from the episode up into the card
const laterClose = () => {
  if (cardState.pinned || epCard.hidden) return;
  clearTimeout(cardState.closeT);
  cardState.closeT = setTimeout(() => closeEp(), 110);
};

epCard.addEventListener('pointerenter', () => clearTimeout(cardState.closeT));
epCard.addEventListener('pointerleave', () => { hoverArc = null; paint(); laterClose(); });
epCard.addEventListener('pointerover', (e) => {
  const id = e.target.closest('.ep-row')?.dataset.id || null;
  if (id !== hoverArc) { hoverArc = id; paint(); }
});
epCard.addEventListener('click', (e) => {
  if (e.target.closest('.ep-card-x')) { closeEp(); return; }
  cardState.pinned = true;                       // once you've clicked inside, it stays
  const row = e.target.closest('.ep-row');
  if (row) openClip(+row.dataset.i, row);
});
document.addEventListener('pointerdown', (e) => {
  if (!epCard.hidden && !view.open && !root.contains(e.target)) closeEp();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !epCard.hidden && !view.open) closeEp(); });

svg.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const hit = e.target.closest('.hit'), bar = e.target.closest('.ep');
  if (bar) { hideTip(); if (!cardState.pinned) openEp(+bar.dataset.ep); return; }
  if (!epCard.hidden && !cardState.pinned) {
    // the card hangs below the episodes: heading down, give the pointer a beat to reach it; heading up, close now
    const barTop = svg.getBoundingClientRect().top + geo.y0;
    if (e.clientY < barTop) closeEp(); else { laterClose(); return; }
  }
  if (hit) { hoverArc = hit.dataset.id; showTip(describe(byId(hoverArc)), e); }
  else { hoverArc = null; hideTip(); }
  paint();
});
svg.addEventListener('pointerleave', (e) => {
  hoverArc = null; hideTip();
  const r = epCard.getBoundingClientRect();         // leaving toward the card keeps it a beat; anywhere else, close
  const toward = !epCard.hidden && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 14;
  if (toward) laterClose(); else if (!cardState.pinned) closeEp();
  paint();
});
svg.addEventListener('click', (e) => {
  const hit = e.target.closest('.hit'), bar = e.target.closest('.ep');
  if (bar) {
    const n = +bar.dataset.ep;
    pin(null);
    if (cardState.pinned && cardState.n === n) closeEp(); else { cardState.pinned = false; openEp(n, true); }
  } else if (hit) { closeEp(); pin(state.pinned === hit.dataset.id ? null : hit.dataset.id); }
  else { closeEp(); pin(null); }
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
  let lastH = innerHeight;
  addEventListener('resize', () => { if (innerHeight !== lastH) { lastH = innerHeight; draw(); } });
})();
