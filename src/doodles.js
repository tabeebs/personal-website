// Doodles: crayon renditions of the resume, GitHub and LinkedIn icons beside each link, in the same crayon
// language as the meadow. Fills are rows of short waxy strokes over a pastel layer printed slightly out of
// register (letters and the Octocat are paper left bare), the linework is navy crayon, and the whole drawing
// redraws a few times a second.
// At rest a drawing boils slowly. Hovering its row (or focusing its link) boils it on twos, slides the colour
// layer into register, and the drawing comes to life: the resume writes itself out over a second page, the
// Octocat perks its ears and lifts its tail, the dot on the LinkedIn i hops.
import { PAL, C, BOIL_MS, hash } from './crayon.js';

const SIZE = 36;                         // css px, drawings are authored in this space
const HX = 2.4, HY = 3.6;                // hatch cell, css px
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// ---- shapes ----
const circle = (cx, cy, r, n = 9) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]);
const blob = (cx, cy, rx, ry, rot = 0, n = 9) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry * (1 - .25 * Math.max(0, Math.sin(a)));
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});
const fill = (pts, ink, tint, holes = []) => ({ kind: 'fill', pts, ink, tint, holes });
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const roundRect = (x0, y0, x1, y1, r, n = 4) => {
  const pts = [], corners = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
};
const line = (pts, ink = C.navy, w = 1.5) => ({ kind: 'line', pts, ink, w });

// Each drawing is a function of t, how alive it is (0 at rest, 1 hovered).
const DRAWINGS = {
  // Resume: a sheet with a photo and lines of text; on hover the lines write themselves out and a second
  // page slides out from behind
  resume(t) {
    const g = ease(t), out = [];
    const bx = lerp(1.6, 4.2, g), by = lerp(-1, -2.4, g);
    out.push(fill([[10 + bx, 5 + by], [29 + bx, 5 + by], [29 + bx, 32.5 + by], [10 + bx, 32.5 + by]], C.mustard, C.mustardP));
    out.push(fill([[7.5, 5.5], [22.5, 5.5], [27, 10], [27, 33.5], [7.5, 33.5]], C.teal, C.tealP));
    out.push(fill(circle(12.2, 11.4, 2.5, 8), C.tomato, C.tomatoP));
    out.push(line([[22.5, 5.6], [22.5, 10], [26.9, 10]], C.navy, 1.1));
    const w = lerp(.55, 1, g);
    out.push(line([[16, 10], [16 + 5 * w, 10]], C.navy, 1.3));
    out.push(line([[16, 13.2], [16 + 3.4 * w, 13.2]], C.navy, 1));
    [[18.5, 12.5], [22, 10.5], [25.5, 12.5], [29, 7.5]].forEach(([y, len], i) => {
      const k = clamp01((g - i * .12) / .55);
      out.push(line([[10.8, y], [10.8 + len * lerp(.5, 1, k), y]], C.navy, 1.05));
    });
    return out;
  },
  // GitHub: the Octocat mark, a crayon circle with the cat left as bare paper
  github(t) {
    const g = ease(t), ear = g * 1.1, tail = g;
    const cat = [
      [12.4, 9 - ear], [14.6, 11.6], [18, 11], [21.4, 11.6], [23.6, 9 - ear], [24.6, 12.4], [25, 15.6], [24, 19.2],
      [21.5, 21.3], [20.3, 22], [21.2, 23.6], [21.3, 30.8], [14.7, 30.8], [14.7, 27.2],
      [12.4, 27.4 - tail * .6], [10.6, 25.8 - tail * 1.4], [9.6 - tail * .4, 23.6 - tail * 2.2], [11.1, 23.9 - tail * 1.4], [12.6, 25.2 - tail * .6], [14.7, 25],
      [14.8, 23.6], [15.7, 22], [14.5, 21.3], [12, 19.2], [11, 15.6], [11.4, 12.4],
    ];
    return [
      fill(circle(18, 18, 14.2, 20), C.navy, C.lilac, [cat]),
      line(circle(18, 18, 14.2, 20).concat([[18 + 14.2, 18]]), C.navy, 1.1),
    ];
  },
  // LinkedIn: the rounded square with "in" left as bare paper; the dot on the i hops
  linkedin(t) {
    const g = ease(t), hop = Math.sin(g * Math.PI) * 1.6 + g * .4;
    const holes = [
      rect(10.4, 15.4, 14.2, 26.6),
      circle(12.3, 11.4 - hop, 2.2, 8),
      [[16.4, 26.6], [16.4, 15.4], [20, 15.4], [20, 17], [21.5, 15.6], [23.6, 15.2], [25.6, 16], [26.7, 18.2], [26.8, 26.6], [23.2, 26.6],
        [23.2, 20.3], [22.6, 19.1], [21.3, 19.1], [20.3, 20], [20.1, 26.6]],
    ];
    const sq = roundRect(5.5, 5.5, 30.5, 30.5, 4.6);
    return [fill(sq, C.blue, C.blueP, holes), line(sq.concat([sq[0]]), C.navy, 1)];
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const insideShape = (it, x, y) => inside(it.pts, x, y) && !it.holes.some((h) => inside(h, x, y));

function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function doodle(el) {
  const draw = DRAWINGS[el.dataset.doodle];
  if (!draw) return;
  const canvas = document.createElement('canvas');
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 3);
    canvas.width = canvas.height = Math.round(SIZE * dpr);
  };
  size();

  let t = 0, target = 0, frame = 0, visible = true, timer = 0;

  function paint() {
    const f = frame, j = (k, a = .35) => (hash(f, k, 31) - .5) * 2 * a;   // per-drawing jitter
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const items = draw(t);
    // the colour layer, printed out of register; it slides into place as the drawing comes alive
    const reg = lerp(1, .3, ease(t));
    const ox = 1.3 * reg + j(1, .3), oy = 1 * reg + j(2, .3);
    ctx.globalAlpha = .92;
    items.forEach((it, n) => {
      if (it.kind !== 'fill') return;
      ctx.beginPath();
      [it.pts, ...it.holes].forEach((poly, h) => {
        poly.forEach(([x, y], i) => { const px = x + ox + j(n * 40 + h * 7 + i, .3), py = y + oy + j(n * 40 + h * 7 + i + 20, .3); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.closePath();
      });
      ctx.fillStyle = PAL[it.tint];
      ctx.fill('evenodd');
    });
    ctx.globalAlpha = 1;
    // the crayon: short vertical strokes filling each shape, a fresh set every drawing
    const fills = items.map((it, n) => ({ ...it, n })).filter((it) => it.kind === 'fill');
    ctx.lineCap = 'round';
    items.forEach((it, n) => {
      if (it.kind !== 'fill') return;
      ctx.strokeStyle = PAL[it.ink];
      ctx.lineWidth = .95;
      ctx.beginPath();
      for (let y = HY * .5; y < SIZE; y += HY) {
        for (let x = HX * .5 + (Math.floor(y / HY) % 2) * HX * .5; x < SIZE; x += HX) {
          if (!insideShape(it, x, y)) continue;                     // letters and the cat stay bare paper
          if (fills.some((o) => o.n > n && insideShape(o, x, y))) continue;   // a shape drawn on top owns this spot
          const r = hash(Math.round(x * 10), Math.round(y * 10), f * 7 + n);
          if (r < .12) continue;                                  // paper showing through
          const len = HY * (.45 + r * .55), dx = (hash(n, Math.round(x * 10), f) - .5) * .7, dy = (r - .5) * 1.2;
          if (r > .86) { ctx.moveTo(x + dx, y + dy - len * .5); ctx.lineTo(x + dx, y + dy + len * .1); ctx.moveTo(x + dx, y + dy + len * .45); ctx.lineTo(x + dx, y + dy + len * .5); } // !
          else { ctx.moveTo(x + dx, y + dy - len * .5); ctx.lineTo(x + dx + (r - .5) * .5, y + dy + len * .5); }
        }
      }
      ctx.stroke();
    });
    // navy linework, two waxy passes
    items.forEach((it, n) => {
      if (it.kind !== 'line') return;
      ctx.strokeStyle = PAL[it.ink];
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = it.w * (pass ? .55 : 1);
        ctx.globalAlpha = pass ? .55 : .95;
        ctx.beginPath();
        it.pts.forEach(([x, y], i) => { const px = x + j(n * 50 + i + pass * 9, .32), py = y + j(n * 50 + i + 30 + pass * 9, .32); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  // On twos while alive, a slow shimmer at rest, nothing when off screen.
  function tick() {
    timer = 0;
    if (!visible) return;
    const alive = t > 0 || target > 0;
    if (reduced) { t = target; paint(); return; }
    t = target > t ? Math.min(1, t + .22) : Math.max(0, t - .16);
    frame++;
    paint();
    timer = setTimeout(tick, alive ? BOIL_MS : BOIL_MS * 3.2);
  }
  const wake = () => { if (timer) clearTimeout(timer); tick(); };

  const row = el.closest('li') || el;
  const on = () => { target = 1; wake(); };
  const off = () => { target = 0; wake(); };
  row.addEventListener('pointerenter', on);
  row.addEventListener('pointerleave', off);
  row.addEventListener('focusin', on);
  row.addEventListener('focusout', off);
  // touch: a tap brings it to life for a moment
  row.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { on(); setTimeout(off, 1400); } });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(el);
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', () => { size(); paint(); });
  frame = Math.floor(hash(el.dataset.doodle.length, 5) * 100);
  paint();
}

document.querySelectorAll('[data-doodle]').forEach(doodle);
