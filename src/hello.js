// The hello at the top of the panel. Each letter of a .hi heading is its own little body: the letters drop in and
// bounce when the page opens, and hovering the word sends a wave of hops (squash, jump, land) through all of it.
// A heading with data-meaning also says what the word means: a little label bounces up above it while it's
// hovered (or for a moment after a tap).
// A name marked .name gets a crayon highlighter swash behind it, in the meadow's crayon (src/crayon.js): mustard
// waxy strokes over a pastel layer printed a little out of register, boiling on twos. It sweeps in from the left
// just after the letters have landed.
// Source for build/hello.js: rebuild with `npm run build` after editing.
import { PAL, C, BOIL_MS, hash } from './crayon.js';

const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ---- hopping letters ----
const hopFrames = (h) => [
  { transform: 'none' },
  { transform: 'translateY(1px) scale(1.14, .82)', offset: .16 },
  { transform: `translateY(${-h}px) scale(.9, 1.12)`, offset: .46 },
  { transform: 'translateY(0) scale(1.12, .88)', offset: .72 },
  { transform: 'translateY(-1px) scale(.97, 1.03)', offset: .87 },
  { transform: 'none' },
];
function hop(el, delay = 0) {
  if (calm.matches || el.getAnimations().some((a) => a.playState === 'running' && !a.pending && a.currentTime > 0)) return;
  el.animate(hopFrames(el.textContent === '!' ? 11 : 7), { duration: 580, delay, easing: 'cubic-bezier(.3, .6, .4, 1)' });
}
const wave = (letters, delay = 0) => letters.forEach((l, i) => hop(l, delay + i * 42));

function lettered(h) {
  const text = h.textContent.trim();
  h.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr'; sr.textContent = text;
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  const letters = [];
  for (const ch of text) {
    if (ch === ' ') { shown.append(' '); continue; }
    const s = document.createElement('span');
    s.className = 'ch'; s.textContent = ch;
    shown.append(s); letters.push(s);
  }
  h.append(sr, shown);
  shown.addEventListener('pointerenter', () => wave(letters));   // the word itself, not the empty line beside it
  if (h.dataset.meaning) meaning(h, shown, sr);
  return letters;
}

// what the word means, in a label that pops up above it
function meaning(h, shown, sr) {
  const tip = document.createElement('span');
  tip.className = 'meaning';
  tip.textContent = h.dataset.meaning;
  shown.classList.add('glossed');
  shown.append(tip);
  sr.textContent += ` (${h.dataset.meaning})`;   // screen readers hear it with the word
  let timer = 0;
  const show = () => { clearTimeout(timer); tip.classList.add('show'); };
  const hide = (wait = 0) => { clearTimeout(timer); timer = setTimeout(() => tip.classList.remove('show'), wait); };
  shown.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
  shown.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(80); });
  shown.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { show(); hide(1800); } });
}

// ---- the crayon swash behind a name ----
const HX = 2.4, HY = 3.6;   // hatch cell, as on the doodles
function swash(el) {
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  el.prepend(cv);
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr = 1, reveal = 1, frame = Math.floor(Math.random() * 99), alive = false, visible = true, timer = 0, sweeping = 0;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 3);
    w = cv.offsetWidth; h = cv.offsetHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  };
  // the band: a thick crayon stroke, a little tilted, its edges wavering and its ends tapered
  const band = (x, ph) => {
    const taper = Math.sqrt(Math.min(1, x / 7, (w - x) / 7, 1)), tilt = (x / w - .5) * h * .1;
    const mid = h * .55 - tilt + Math.sin(x * .21 + ph) * .5, half = h * (alive ? .4 : .36) * Math.max(0, taper);
    return [mid - half + Math.sin(x * .5 + ph * 2) * .45, mid + half + Math.sin(x * .37 + ph * 3) * .45];
  };
  function paint() {
    if (!w || !h) return;
    const f = frame, ph = hash(f, 3, 11) * 6.28, cut = w * reveal;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, cut, h); ctx.clip();
    // the pastel layer, printed out of register
    const ox = 1 + (hash(f, 7) - .5) * .6, oy = .8 + (hash(f, 8) - .5) * .6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) { const [t] = band(x, ph); x ? ctx.lineTo(x + ox, t + oy) : ctx.moveTo(x + ox, t + oy); }
    for (let x = w; x >= 0; x -= 2) { const [, b] = band(x, ph); ctx.lineTo(x + ox, b + oy); }
    ctx.closePath();
    ctx.globalAlpha = .9; ctx.fillStyle = PAL[C.mustardP]; ctx.fill();
    // the crayon: short vertical waxy strokes, a fresh set every drawing, with paper showing through
    ctx.globalAlpha = .55; ctx.strokeStyle = PAL[C.mustard]; ctx.lineWidth = .95; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = HY * .5; y < h; y += HY) {
      for (let x = HX * .5 + (Math.floor(y / HY) % 2) * HX * .5; x < cut; x += HX) {
        const [t, b] = band(x, ph);
        if (y < t || y > b) continue;
        const r = hash(Math.round(x * 10), Math.round(y * 10), f * 7);
        if (r < .14) continue;
        const len = HY * (.45 + r * .55), dx = (hash(Math.round(x * 10), f, 5) - .5) * .7, dy = (r - .5) * 1.2;
        ctx.moveTo(x + dx, y + dy - len * .5); ctx.lineTo(x + dx + (r - .5) * .5, y + dy + len * .5);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // boils on twos while hovered or sweeping, slowly at rest, not at all off screen
  function tick() {
    timer = 0;
    if (!visible) return;
    frame++; paint();
    timer = setTimeout(tick, alive || sweeping ? BOIL_MS : BOIL_MS * 3.2);
  }
  const wake = () => { if (timer) clearTimeout(timer); tick(); };
  function sweep(delay = 0) {
    if (calm.matches) { reveal = 1; paint(); return; }
    reveal = 0; paint();
    const run = ++sweeping, t0 = performance.now() + delay;
    const step = (now) => {
      if (run !== sweeping) return;
      const k = Math.min(1, Math.max(0, (now - t0) / 520));
      reveal = 1 - (1 - k) ** 3;
      paint();
      if (k < 1) requestAnimationFrame(step); else sweeping = 0;
    };
    requestAnimationFrame(step);
    wake();
  }
  el.addEventListener('pointerenter', () => { alive = true; wake(); });
  el.addEventListener('pointerleave', () => { alive = false; wake(); });
  // watch the canvas, not the name: an inline element never reports a new size, so a name first drawn while its
  // view was hidden (the page opened on another tab) would keep a canvas of no size and never show its swash
  new ResizeObserver(() => { size(); paint(); }).observe(cv);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(el);
  size();
  return { sweep };
}

// ---- wiring ----
const DROP = 640;   // how long each letter takes to drop in and settle, ms
for (const view of document.querySelectorAll('.view')) {
  const letters = [...view.querySelectorAll('.hi')].flatMap(lettered);
  const names = [...view.querySelectorAll('.name')].map(swash);
  // opening the page: the letters drop in and bounce, then the swash sweeps in under the name
  if (!view.hidden && !calm.matches) {
    letters.forEach((l, i) => l.animate([
      { opacity: 0, transform: 'translateY(-16px) scale(.7, 1.2)' },
      { opacity: 1, transform: 'translateY(2px) scale(1.12, .86)', offset: .55 },
      { transform: 'translateY(-2px) scale(.96, 1.04)', offset: .78 },
      { transform: 'none' },
    ], { duration: DROP, delay: 180 + i * 48, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'backwards' }));
    // a tenth of a second after the last letter has landed
    names.forEach((n) => n.sweep(180 + Math.max(0, letters.length - 1) * 48 + DROP + 100));
  }
  // coming back to a view: a wave through its heading, and the swash sweeps in again
  new MutationObserver(() => {
    if (view.hidden) return;
    wave(letters, 260);
    names.forEach((n) => n.sweep(420));
  }).observe(view, { attributes: true, attributeFilter: ['hidden'] });
}
