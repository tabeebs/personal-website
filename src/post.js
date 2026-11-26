// A piece of writing's page (writing/<name>.html): the drawing at the top that plays once, the contents rail down
// the left (built from the piece's h2s and h3s) whose orange line follows you as you read and glides to a section
// when you click it, the same contents folded up for narrow screens, and the demo panel's switches.

const body = document.body;
const SVG = 'http://www.w3.org/2000/svg';

/* ---------------- the drawing that plays once ---------------- */

// each stroke: [path, when it starts (s), how long it takes (s), extra class]
const DRAWINGS = {
  house: {
    view: '0 -8 200 128',
    strokes: [
      ['M6 112 C50 110 120 113 194 111', 0, .45],
      ['M48 111 L49 58 L131 57 L132 111', .2, .55],
      ['M40 62 L90 22 L140 61', .65, .4],
      ['M114 41 L114 26 L124 26 L124 49', .95, .25],
      ['M80 111 L80 84 C80 77 98 77 98 84 L98 111', 1, .3],
      ['M106 70 L122 70 L122 84 L106 84 Z M114 70 L114 84 M106 77 L122 77', 1.15, .35],
      ['M120 20 C113 14 126 10 119 3 C115 -2 124 -6 128 -8', 1.3, .55, 'accent'],
      ['M18 112 C19 106 22 104 24 101 M24 112 C25 107 27 105 30 103', 1.45, .25, 'accent'],
    ],
    washes: [['M43 61 L90 25 L137 60 Z', 1.05]],
  },
  sprout: {
    view: '0 0 200 120',
    strokes: [
      ['M70 84 L130 84 L122 115 L78 115 Z', 0, .5],
      ['M64 84 L136 84', .35, .3],
      ['M77 91 C90 88 110 93 123 90', .55, .3],
      ['M100 89 C99 72 102 56 100 34', .75, .5],
      ['M100 60 C88 53 77 57 70 47 C83 40 96 45 100 60 Z', 1.15, .45, 'accent'],
      ['M100 46 C110 36 123 38 132 29 C129 43 115 51 100 46 Z', 1.35, .45, 'accent'],
    ],
    washes: [['M100 60 C88 53 77 57 70 47 C83 40 96 45 100 60 Z', 1.45], ['M100 46 C110 36 123 38 132 29 C129 43 115 51 100 46 Z', 1.65]],
    pops: [[100, 31, 3.2, 1.75]],
  },
};

// an ascii cloud, in the sky's own spirit; * are the accent
const CLOUD = [
  '           .--~~~--.',
  '      .--(          )--.',
  '    (     ~    .    ~    )',
  '   (   .     ~    ~   .   )',
  '    `--.___.--~~~--.___.--\'',
  '          *    *    *',
];

const art = document.querySelector('.post-art');

function drawArt(kind) {
  if (!art) return;
  art.replaceChildren();
  if (kind === 'none') return;
  if (kind === 'cloud') {
    const pre = document.createElement('pre');
    for (const [r, line] of CLOUD.entries()) {
      for (const ch of line) {
        if (ch === ' ') { pre.append(' '); continue; }
        const s = document.createElement('span');
        s.textContent = ch;
        if (ch === '*') s.className = 'a';
        // the cloud fills in from the middle out, with a little scatter, over about a second
        s.style.setProperty('--at', `${(r * .08 + Math.random() * .7).toFixed(2)}s`);
        pre.append(s);
      }
      pre.append('\n');
    }
    art.append(pre);
    return;
  }
  const d = DRAWINGS[kind];
  if (!d) return;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', d.view);
  for (const [p, at] of d.washes || []) {
    const w = document.createElementNS(SVG, 'path');
    w.setAttribute('d', p); w.setAttribute('class', 'wash');
    w.setAttribute('fill', 'var(--accent)'); w.setAttribute('fill-opacity', '.14');
    w.style.setProperty('--at', `${at}s`);
    svg.append(w);
  }
  for (const [p, at, dur, cls] of d.strokes) {
    const s = document.createElementNS(SVG, 'path');
    s.setAttribute('d', p); s.setAttribute('pathLength', '1');
    s.setAttribute('class', `ink ${cls || ''}`);
    s.style.setProperty('--at', `${at}s`); s.style.setProperty('--dur', `${dur}s`);
    svg.append(s);
  }
  for (const [cx, cy, r, at] of d.pops || []) {
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('class', 'pop'); c.setAttribute('fill', 'var(--accent)');
    c.style.setProperty('--at', `${at}s`);
    svg.append(c);
  }
  art.append(svg);
}

drawArt(body.dataset.art || 'house');

/* ---------------- the contents: the rail, and the folded-up list ---------------- */

const heads = [...document.querySelectorAll('.post-body h2, .post-body h3')];
const rail = document.querySelector('.rail');
const track = rail?.querySelector('.rail-track');
const list = rail?.querySelector('.rail-list');
const inline = document.querySelector('.toc-inline ol');
const items = [];

for (const [i, h] of heads.entries()) {
  if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sub = h.tagName === 'H3';
  if (list) {
    const li = document.createElement('li');
    if (sub) li.className = 'sub';
    li.style.setProperty('--i', i);
    li.innerHTML = `<a href="#${h.id}"><span class="mark" aria-hidden="true"></span><span class="label"></span></a>`;
    li.querySelector('.label').textContent = h.textContent;
    list.append(li);
    items.push(li);
  }
  if (inline) {
    const li = document.createElement('li');
    if (sub) li.className = 'sub';
    li.innerHTML = `<a href="#${h.id}"></a>`;
    li.firstChild.textContent = h.textContent;
    inline.append(li);
  }
}
if (!heads.length) { rail?.remove(); document.querySelector('.toc-inline')?.remove(); }

let centres = [];
let active = -2;

// where each marker sits down the rail, so the line runs from the first to the last and the orange can stop on any
function layout() {
  if (!track || !rail || getComputedStyle(rail).display === 'none') return;
  centres = items.map(li => { const m = li.querySelector('.mark'); return m.offsetTop + m.offsetHeight / 2 + li.offsetTop; });
  if (!centres.length) return;
  track.style.setProperty('--top', `${centres[0] + list.offsetTop}px`);
  track.style.setProperty('--len', `${centres.at(-1) - centres[0]}px`);
  paint(active, true);
}

function paint(i, quiet) {
  items.forEach((li, j) => { li.classList.toggle('active', j === i); li.classList.toggle('passed', j < i); });
  if (track && centres.length) track.style.setProperty('--fill', `${i < 0 ? 0 : centres[i] - centres[0]}px`);
  // keep the section you're in within view when the rail has more sections than room
  const li = items[i];
  if (!quiet && li && track) {
    const top = li.offsetTop, bot = top + li.offsetHeight;
    if (top < track.scrollTop + 20 || bot > track.scrollTop + track.clientHeight - 20)
      track.scrollTo({ top: top - track.clientHeight / 2, behavior: 'smooth' });
  }
}

function setActive(i) {
  if (i === active) return;
  active = i;
  paint(i);
}

// the section you're reading is the last one whose heading has passed a line a quarter of the way down the screen;
// at the very bottom of the page it's the last section, however short
let lockUntil = 0;
function onScroll() {
  if (performance.now() < lockUntil) return;
  const line = innerHeight * .25;
  let i = -1;
  for (const [j, h] of heads.entries()) if (h.getBoundingClientRect().top <= line) i = j;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && heads.length) i = heads.length - 1;
  setActive(i);
}
let ticking = false;
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });

// clicking a section: the orange glides there straight away, and the page follows
function go(e) {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const i = heads.findIndex(h => `#${h.id}` === a.getAttribute('href'));
  if (i < 0) return;
  e.preventDefault();
  setActive(i);
  lockUntil = performance.now() + 1200;
  const release = () => { lockUntil = 0; onScroll(); };
  addEventListener('scrollend', release, { once: true });
  heads[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${heads[i].id}`);
}
list?.addEventListener('click', go);
inline?.addEventListener('click', go);

addEventListener('resize', layout);
document.fonts?.ready.then(layout);
layout();
onScroll();

/* ---------------- DEMO ONLY: the panel's switches ---------------- */

const demo = document.querySelector('.demo');
if (demo) {
  const sync = () => {
    for (const seg of demo.querySelectorAll('[data-set]')) {
      const v = body.dataset[seg.dataset.set];
      for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === v));
    }
  };
  demo.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('demo-toggle')) {
      b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
      return;
    }
    const seg = b.closest('[data-set]');
    if (seg) {
      const key = seg.dataset.set;
      body.dataset[key] = b.dataset.value;
      sync();
      if (key === 'art') drawArt(b.dataset.value);
      if (key === 'rail') requestAnimationFrame(() => { layout(); onScroll(); });
      return;
    }
    if (b.hasAttribute('data-replay')) {
      if (body.dataset.art === 'none') { body.dataset.art = 'house'; sync(); }
      scrollTo({ top: 0, behavior: 'smooth' });
      drawArt(body.dataset.art);
      return;
    }
    if (b.dataset.jump === 'top') scrollTo({ top: 0, behavior: 'smooth' });
    if (b.dataset.jump === 'more') {
      const more = document.querySelector('.more');
      more.scrollIntoView({ behavior: 'smooth', block: 'center' });
      more.classList.remove('flash'); void more.offsetWidth; more.classList.add('flash');
    }
  });
  sync();
  // on a phone the panel would cover the page, so it starts folded up
  if (innerWidth < 700) demo.querySelector('.demo-toggle').setAttribute('aria-expanded', 'false');
}

// the made-up pieces in the list don't go anywhere yet
for (const a of document.querySelectorAll('a[data-dead]')) a.addEventListener('click', e => e.preventDefault());
