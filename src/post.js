// A piece of writing's page (writing/<name>.html): the drawing at the top that plays once, the contents rail down
// the left (built from the piece's h2s and h3s) whose orange line follows you as you read and glides to a section
// when you click it, the same contents folded up for narrow screens, and the demo panel's switches.

const body = document.body;
const SVG = 'http://www.w3.org/2000/svg';

/* ---------------- the drawing that plays once ---------------- */

// each stroke: [path, when it starts (s), how long it takes (s), extra class]
const DRAWINGS = {
  // the interconnectedness of attack on titan: episodes along a line, and arcs looping between them, like a tiny
  // trailer for the arc diagram further down the piece
  arcs: {
    view: '0 0 220 120',
    strokes: [
      ['M8 104 C70 103 150 105 212 104', 0, .4],
      ['M24 104 C24 59 92 59 92 104', .65, .45],
      ['M58 104 C58 36 160 36 160 104', .85, .55, 'accent'],
      ['M92 104 C92 81 126 81 126 104', 1.05, .3],
      ['M24 104 C24 -10 196 -10 196 104', 1.15, .7],
      ['M126 104 C126 57 196 57 196 104', 1.4, .45, 'accent'],
    ],
    pops: [[24, 104, 2.8, .3], [58, 104, 2.8, .36], [92, 104, 2.8, .42], [126, 104, 2.8, .48], [160, 104, 2.8, .54], [196, 104, 2.8, .6]],
  },
  // closed mouths don't get fed: a paper plane (the cold email, the linkedin message) loops once and lands up high
  plane: {
    view: '0 0 220 120',
    strokes: [
      ['M8 104 C40 104 58 64 88 62 C118 60 122 96 100 96 C78 96 84 56 120 46 C148 38 168 40 186 34', 0, .95, 'accent thin'],
      ['M182 40 L214 20 L196 46 Z', .85, .35],
      ['M214 20 L190 37 L196 46', 1.05, .25],
    ],
    washes: [['M182 40 L214 20 L196 46 Z', 1.15]],
  },
  // why is skincare so confusing?: the routine lined up on a shelf, one bottle at a time, and a drop to finish
  bottles: {
    view: '0 0 220 120',
    strokes: [
      ['M10 111 C80 110 150 112 210 111', 0, .4],
      ['M32 110 L36 58 L54 58 L58 110 Z', .3, .45],
      ['M40 58 L40 47 L50 47 L50 58', .6, .2],
      ['M84 110 C79 110 79 77 86 72 L106 72 C113 77 113 110 108 110 Z', .55, .45],
      ['M90 72 L90 63 L102 63 L102 72 M92 63 L92 50 C92 42 100 42 100 50 L100 63', .85, .35],
      ['M134 110 L134 67 C134 59 156 59 156 67 L156 110 Z', .8, .45],
      ['M141 61 L141 50 L149 50 L149 61 M145 50 L145 44 L161 44', 1.1, .25],
      ['M39 84 L51 84 M88 92 L104 92 M139 86 L151 86', 1.25, .3, 'accent'],
      ['M186 76 C182 84 178 88 178 93 C178 98 182 101 186 101 C190 101 194 98 194 93 C194 88 190 84 186 76 Z', 1.45, .35, 'accent fall'],
    ],
    washes: [['M186 76 C182 84 178 88 178 93 C178 98 182 101 186 101 C190 101 194 98 194 93 C194 88 190 84 186 76 Z', 1.6]],
  },
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
    w.setAttribute('fill', 'currentColor'); w.setAttribute('fill-opacity', '.08');
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
    c.setAttribute('class', 'pop'); c.setAttribute('fill', 'var(--second)');
    c.style.setProperty('--at', `${at}s`);
    svg.append(c);
  }
  art.append(svg);
}

drawArt(body.dataset.art || 'arcs');

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

// where each marker sits down the rail, so the line runs from the first to the last
function layout() {
  if (!track || !rail || getComputedStyle(rail).display === 'none') return;
  centres = items.map(li => { const m = li.querySelector('.mark'); return m.offsetTop + m.offsetHeight / 2 + li.offsetTop; });
  if (!centres.length) return;
  track.style.setProperty('--top', `${centres[0] + list.offsetTop}px`);
  track.style.setProperty('--len', `${centres.at(-1) - centres[0]}px`);
}

function setActive(i) {
  if (i === active) return;
  active = i;
  items.forEach((li, j) => { li.classList.toggle('active', j === i); li.classList.toggle('passed', j < i); });
  // keep the section you're in within view when the rail has more sections than room
  const li = items[i];
  if (li && track) {
    const top = li.offsetTop, bot = top + li.offsetHeight;
    if (top < track.scrollTop + 20 || bot > track.scrollTop + track.clientHeight - 20)
      track.scrollTo({ top: top - track.clientHeight / 2, behavior: 'smooth' });
  }
}

// Which section you're in: the last heading that has come up to just under the top of the screen (where a click
// lands it). The line doesn't stop at markers: between two headings it fills in step with how far you've read
// through that section, so it creeps down as you scroll rather than jumping from marker to marker.
const LINE = 80;   // px from the top: a little under where a clicked heading comes to rest (its 28px scroll margin)
let held = -1;     // a section you clicked stays the one you're in until you scroll yourself
function reading() {
  if (held >= 0) return { i: held, at: centres[held] ?? 0 };
  let i = -1;
  for (const [j, h] of heads.entries()) if (h.getBoundingClientRect().top <= LINE) i = j;
  if (i < 0 || !centres.length) return { i, at: centres[0] ?? 0 };
  const top = heads[i].getBoundingClientRect().top;
  const next = heads[i + 1]?.getBoundingClientRect().top
    ?? document.documentElement.scrollHeight - scrollY;   // the last section runs to the end of the page
  const k = Math.min(1, Math.max(0, (LINE - top) / Math.max(1, next - top)));
  const to = centres[i + 1] ?? centres[i];
  return { i, at: centres[i] + (to - centres[i]) * k };
}

// the fill eases towards where you are, every frame, so it glides after you instead of snapping
let shown = 0, last = 0, running = false;
function frame(now) {
  const dt = Math.min(64, now - (last || now)); last = now;
  const { i, at } = reading();
  setActive(i);
  const target = Math.max(0, at - (centres[0] ?? 0));
  const ease = 1 - Math.exp(-dt / (held >= 0 ? 170 : 130));
  shown += (target - shown) * ease;
  if (Math.abs(target - shown) < .2) shown = target;
  track?.style.setProperty('--fill', `${shown.toFixed(2)}px`);
  if (shown !== target) requestAnimationFrame(frame); else { running = false; last = 0; }
}
const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
addEventListener('scroll', kick, { passive: true });

// clicking a section: the line glides there and that section stays the one you're in (even a short one near the end,
// which can't scroll all the way to the top) until you scroll yourself
function go(e) {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const i = heads.findIndex(h => `#${h.id}` === a.getAttribute('href'));
  if (i < 0) return;
  e.preventDefault();
  held = i;
  kick();
  heads[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${heads[i].id}`);
}
list?.addEventListener('click', go);
inline?.addEventListener('click', go);
const letGo = () => { if (held >= 0) { held = -1; kick(); } };
for (const ev of ['wheel', 'touchmove']) addEventListener(ev, letGo, { passive: true });
addEventListener('keydown', (e) => { if (/^(Arrow|Page|Home|End| )/.test(e.key) || e.key === ' ') letGo(); });
addEventListener('pointerdown', (e) => { if (e.target === document.documentElement) letGo(); });   // the scrollbar

const relayout = () => { layout(); kick(); };
addEventListener('resize', relayout);
document.fonts?.ready.then(relayout);
relayout();

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
      return;
    }
    if (b.hasAttribute('data-replay')) {
      if (body.dataset.art === 'none') { body.dataset.art = 'arcs'; sync(); }
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
