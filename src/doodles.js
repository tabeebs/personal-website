// Doodles: a small crayon drawing beside each collection (a pot of flowers, a vase, a single stem), in the same
// crayon language as the meadow. Fills are rows of short waxy strokes over a pastel layer printed slightly out
// of register, the linework is navy crayon, and the whole drawing redraws a few times a second.
// At rest a drawing boils slowly. Hovering its row (or focusing its link) boils it on twos, slides the colour
// layer into register, and the drawing comes to life: the bouquet lifts, a stem grows out of the vase, the
// flower opens.
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
const fill = (pts, ink, tint) => ({ kind: 'fill', pts, ink, tint });
const line = (pts, ink = C.navy, w = 1.5) => ({ kind: 'line', pts, ink, w });

// Each drawing is a function of t, how alive it is (0 at rest, 1 hovered).
const DRAWINGS = {
  // Blog: a pot of flowers, like the reference's first tile
  pot(t) {
    const lift = ease(t) * 2.6, sp = 1 + .1 * ease(t);
    const heads = [[11, 13, C.teal, C.tealP], [16.5, 8.5, C.lilac, C.lilacP], [22.5, 10, C.teal, C.tealP], [26, 15.5, C.tomato, C.tomatoP], [15, 17, C.lilac, C.lilacP]];
    const out = [];
    heads.forEach(([x, y, ink, tint], i) => {
      const hx = 18 + (x - 18) * sp, hy = y - lift * (1 - i * .12);
      out.push(line([[18 + (i - 2) * .9, 23], [lerp(18, hx, .55), lerp(23, hy, .55) + 1], [hx, hy + 2]], i % 2 ? C.navy : C.teal, 1.2));
    });
    heads.forEach(([x, y, ink, tint], i) => {
      const hx = 18 + (x - 18) * sp, hy = y - lift * (1 - i * .12);
      out.push(fill(blob(hx, hy, 3.3 + .3 * t, 2.7 + .3 * t, i * .7), ink, tint));
    });
    out.push(fill([[10.5, 22.5], [25.5, 22.5], [24.6, 30], [23.5, 33.4], [12.5, 33.4], [11.4, 30]], C.mustard, C.mustardP));
    out.push(line([[10.2, 22.6], [25.8, 22.4]], C.navy, 1.4));
    return out;
  },
  // Projects: a vase; a stem grows out of it with a flower on top
  vase(t) {
    const g = ease(t), out = [];
    // the vase sits a little smaller and lower, leaving the sky above it for the stem
    const V = (pts) => pts.map(([x, y]) => [18 + (x - 18) * .86, 34.5 - (34.5 - y) * .8]);
    if (g > .02) {
      const top = lerp(12, 4.4, g), sway = Math.sin(g * Math.PI) * 1.4;
      out.push(line([[18, 12], [18 + sway * .6, lerp(12, top + 3, .5)], [18 + sway, top + 2.5]], C.navy, 1.2));
      if (g > .35) out.push(fill(blob(18 + sway, top + 1.2, 2.8 * ease((g - .35) / .65), 2.3 * ease((g - .35) / .65), .3), C.tomato, C.tomatoP));
      if (g > .5) out.push(fill(blob(16 + sway * .6, lerp(12, top + 3, .5) + 1, 2.2 * (g - .5) * 2, 1.1 * (g - .5) * 2, -.6), C.teal, C.tealP));
    }
    const body = [[15.6, 6.8], [20.4, 6.8], [20, 10], [24.5, 14], [27.4, 19.5], [26.8, 25.5], [23.8, 31], [18, 33.6], [12.2, 31], [9.2, 25.5], [8.6, 19.5], [11.5, 14], [16, 10]];
    out.push(fill(V(body), C.mustard, C.mustardP));
    out.push(fill(V([[8.7, 20.2], [27.3, 20.2], [27.2, 23.4], [8.8, 23.4]]), C.lilac, C.lilacP));
    out.push(line(V(circle(18, 7, 2.6, 10).concat([[20.6, 7]])), C.navy, 1.3));
    return out;
  },
  // Notes: a single flower on a stem with a leaf, like the reference's lilac bloom
  stem(t) {
    const o = ease(t), out = [];
    out.push(line([[18, 34.5], [17.4, 25], [18, 17]], C.navy, 1.7));
    out.push(fill(blob(23, 26.5 - o * 1.4, 5.2, 2.3, -.55 - o * .3), C.lilac, C.lilacP));
    out.push(fill(blob(13.4, 29.5 - o * .8, 3.6, 1.7, .6 + o * .2), C.teal, C.tealP));
    const r = 4.6 + o * 1.5, cx = 18, cy = 11.5 - o * 1.2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i / 5 * Math.PI * 2 + o * .3;
      out.push(fill(blob(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4.2 + o * .5, 3.1 + o * .4, a), i % 2 ? C.teal : C.lilac, i % 2 ? C.tealP : C.lilacP));
    }
    out.push(fill(circle(cx, cy, 2.5 + o * .4, 8), C.mustard, C.mustardP));
    return out;
  },
};

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
      it.pts.forEach(([x, y], i) => { const px = x + ox + j(n * 40 + i, .3), py = y + oy + j(n * 40 + i + 20, .3); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath();
      ctx.fillStyle = PAL[it.tint];
      ctx.fill();
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
          if (!inside(it.pts, x, y)) continue;
          if (fills.some((o) => o.n > n && inside(o.pts, x, y))) continue;   // a shape drawn on top owns this spot
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
