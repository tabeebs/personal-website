// A peek at UNSW: hovering (or focusing) the UNSW logo hushes the rest of the page behind the blur "the web" uses,
// and a little window pops up above the logo showing the School of Computer Science and Engineering's page. The page
// is coloured in by crayon (below), then scrolls itself slowly down, pausing now and then like someone reading, and
// loops back to the top. It's a full-page screenshot (assets/previews/cse.jpg, 640 x 2000: the site at 1280px wide,
// at half scale) drawn onto a canvas, since UNSW's site can't be framed.
// Source for build/peek.js: rebuild with `npm run build` after editing.

const link = document.querySelector('a.unsw');
if (link) {
  const SRC = '/assets/previews/cse.jpg';
  const CW = 272, CH = 170;                 // the window's picture, in CSS px (16:10, like a laptop screen)
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, devicePixelRatio || 1);

  // the window: a white-framed card holding the canvas
  const card = document.createElement('span');
  card.className = 'peek';
  card.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  cv.width = CW * dpr; cv.height = CH * dpr;
  card.append(cv);
  link.append(card);
  const g = cv.getContext('2d');

  const img = new Image();
  img.decoding = 'async';
  let ready = false;
  img.onload = () => { ready = true; };
  const load = () => { if (!img.src) img.src = SRC; };
  // fetched once the page has settled, so it's there before anyone hovers
  addEventListener('load', () => (window.requestIdleCallback || setTimeout)(load, { timeout: 2000 }));

  // ---- scrolling: like someone reading, it scrolls a screenful or so, eases to a stop, reads, scrolls on ----
  // positions are in the screenshot's own px; the window shows a 640 x 400 slice of it
  const VW = 640, VH = VW * CH / CW;
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  let plan = [], planAt = 0;
  function makePlan(max) {
    // a list of [from, to, duration, then hold] moves, ending back at the top
    const steps = []; let y = 0;
    let hold = 400;   // a short look at the top before it starts scrolling
    while (y < max) {
      const to = Math.min(max, y + 260 + Math.random() * 220);
      steps.push({ from: y, to, dur: 700 + (to - y) * 1.1, hold });
      y = to; hold = 450 + Math.random() * 600;
    }
    steps.push({ from: y, to: 0, dur: 1300, hold: 1100 });  // back up to the top, then wait before it starts again
    return steps;
  }
  function scrollAt(t) {
    const max = Math.max(0, img.naturalHeight - VH);
    if (!plan.length) plan = makePlan(max);
    let u = t - planAt;
    for (;;) {
      for (const s of plan) {
        if (u < s.hold) return s.from;
        u -= s.hold;
        if (u < s.dur) return s.from + (s.to - s.from) * ease(u / s.dur);
        u -= s.dur;
      }
      planAt = t - u; plan = makePlan(max); u = t - planAt;   // round again, with fresh pauses
    }
  }

  // ---- drawing ----
  const W = cv.width, H = cv.height;
  function page(y) {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, y, VW, VH, 0, 0, W, H);
  }

  // crayon: a pass of pastel crayon sweeps across in short waxy vertical strokes, and the page is coloured in
  // right behind it, the strokes boiling (redrawn a little differently) eight times a second, like the meadow
  const mask = document.createElement('canvas'), mg = mask.getContext('2d');
  mask.width = W; mask.height = H;
  const CRAYON_MS = 650, COL = 7 * dpr;
  const rnd = (a, b, c) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function strokes(ctx, p, lag, boil, color) {
    // each column's stroke runs top to bottom once the sweep (left to right, a little ragged) reaches it
    const cols = Math.ceil(W / COL) + 1;
    ctx.fillStyle = color;
    for (let c = 0; c < cols; c++) {
      const start = (c / cols) * .52 + rnd(c, 7, 0) * .1 + lag;
      const k = Math.min(1, Math.max(0, (p - start) / .26));
      if (!k) continue;
      const x = c * COL + (rnd(c, boil, 1) - .5) * 3 * dpr, w = COL * (1.25 + rnd(c, boil, 2) * .5);
      const len = (H + 16 * dpr) * k, top = -8 * dpr + (rnd(c, boil, 3) - .5) * 6 * dpr;
      ctx.beginPath();
      // a slightly slanted, ragged-ended stroke
      ctx.moveTo(x, top); ctx.lineTo(x + w, top + rnd(c, boil, 4) * 6 * dpr);
      ctx.lineTo(x + w + 2 * dpr, top + len); ctx.lineTo(x + 2 * dpr, top + len - rnd(c, boil, 5) * 10 * dpr);
      ctx.closePath(); ctx.fill();
    }
  }
  function crayon(y, t) {
    const p = Math.min(1, t / CRAYON_MS);
    if (p >= 1) return page(y), true;
    const boil = Math.floor(t / 125);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // the pastel crayon pass, a step ahead
    g.globalAlpha = .85; strokes(g, p, -.08, boil, '#f4d27c'); g.globalAlpha = 1;
    // the page, coloured in behind it
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, W, H);
    strokes(mg, p, .1, boil + 31, '#000');
    mg.globalCompositeOperation = 'source-in';
    mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
    mg.drawImage(img, 0, y, VW, VH, 0, 0, W, H);
    g.drawImage(mask, 0, 0);
    return false;
  }

  // ---- drift: the window follows the pointer along the logo, sliding a little way left or right and leaning
  // towards it from its foot, eased so it trails the pointer softly. Its rest point is the N of the wordmark, not the
  // middle of crest plus letters: that's where people read the logo's centre, so the window stands level over the N ----
  const FOLLOW = .9, LEAN = 1.2;   // px moved per px of pointer, and degrees of lean half a logo's width from the N
  const N_AT = .351;               // the N's middle, as a fraction of the wordmark's width (from wordmark.svg's paths)
  const mark = link.querySelector('.unsw-mark');
  let aim = 0, drift = 0, lastAt = 0;
  function geometry() {
    const r = link.getBoundingClientRect(), m = (mark || link).getBoundingClientRect();
    const n = mark ? m.left + m.width * N_AT : r.left + r.width / 2;
    return { r, n, half: r.width / 2 || 1, off: n - (r.left + r.width / 2) };   // off: the N's distance from the logo's middle
  }
  function aimAt(x) {
    const { r, n } = geometry();
    aim = Math.max(r.left, Math.min(r.right, x)) - n;   // px from the N, kept within the logo
  }
  function sway(now) {
    const k = lastAt ? 1 - Math.exp(-(now - lastAt) / 90) : 1; lastAt = now;
    drift += (aim - drift) * k;
    const { half, off } = geometry();
    card.style.setProperty('--dx', `${(off + drift * FOLLOW).toFixed(2)}px`);
    card.style.setProperty('--tilt', `${(drift / half * LEAN).toFixed(3)}deg`);
  }

  // ---- opening and closing ----
  let open = false, raf = 0, openedAt = 0, revealed = false, closer = 0;
  function frame(now) {
    raf = 0;
    if (!open) return;
    if (!reduced) sway(now);
    if (!ready) { g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, W, H); raf = requestAnimationFrame(frame); return; }
    if (!openedAt) { openedAt = now; planAt = now; plan = []; }
    const t = now - openedAt;
    // the scroll waits until the page has fully arrived (its plan starts with a pause anyway)
    const y = revealed ? scrollAt(now) : 0;
    if (!revealed) {
      revealed = reduced ? (page(0), true) : crayon(0, t);
      if (revealed) planAt = now;
    } else page(y);
    if (!reduced) raf = requestAnimationFrame(frame);
  }
  function place() {
    // centred over the logo, but kept on screen
    card.style.setProperty('--nudge', '0px');
    const r = card.getBoundingClientRect(), pad = 12;
    let dx = 0;
    if (r.left < pad) dx = pad - r.left;
    else if (r.right > innerWidth - pad) dx = innerWidth - pad - r.right;
    card.style.setProperty('--nudge', `${dx}px`);
  }
  function set(on) {
    clearTimeout(closer);
    if (on === open) return;
    open = on;
    if (on) {
      load();
      openedAt = 0; revealed = false;
      drift = aim; lastAt = 0;   // it opens where the pointer already is, rather than sliding over from the middle
      card.style.setProperty('--dx', `${geometry().off.toFixed(2)}px`); card.style.setProperty('--tilt', '0deg');
      place();
      if (!raf) raf = requestAnimationFrame(frame);
    }
    root.classList.toggle('peek-open', on);
  }
  const later = () => { clearTimeout(closer); closer = setTimeout(() => set(false), 120); };
  link.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { aimAt(e.clientX); set(true); } });
  link.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !card.contains(e.target)) aimAt(e.clientX); });
  link.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') later(); });
  link.addEventListener('focus', () => { if (link.matches(':focus-visible')) { aim = 0; set(true); } });
  link.addEventListener('blur', later);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });

}
