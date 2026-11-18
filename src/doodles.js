// Doodles: crayon renditions of the GitHub, email and LinkedIn icons beside each link, and of the house and
// briefcase on the panel's tabs, in the same crayon language as the meadow. Fills are rows of short waxy
// strokes over a pastel layer printed slightly out of register (letters and the Octocat are paper left bare),
// the linework is navy crayon, and the whole drawing redraws a few times a second.
// At rest a drawing boils slowly. Hovering its row (or focusing its link) boils it on twos, slides the colour
// layer into register, and the drawing comes to life: the Octocat perks its ears and lifts its tail, the envelope
// opens and a letter rises out, the dot on the LinkedIn i hops. Hovering a tab does the same for its button.
// Each row also has a leader line: a row of small ASCII dots on the sky's 8px rhythm. As its icon comes to
// life, a crayon dash in the icon's colour sweeps along it from the name and finishes in a little arrow.
import { PAL, C, BOIL_MS, hash } from './crayon.js';

const SIZE = 36;                         // drawings are authored in this space
const SHOWN = 44;                        // and shown this big, in css px
const HX = 2.4, HY = 3.6;                // hatch cell, css px
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const backOut = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);   // overshoots a little, then settles

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
  // Email: an envelope with a wax seal; on hover the flap swings open and a letter rises out of it
  email(t) {
    const g = ease(t), out = [];
    const apex = lerp(20.5, 2.5, ease(clamp01(t * 1.6))), open = apex < 11.5;   // the flap's tip, folding up
    const rise = backOut(clamp01((g - .35) / .65)), top = lerp(15, 5.5, rise);    // the letter, rising out
    out.push(fill(rect(4.5, 11, 31.5, 29.5), C.mustard, C.mustardP));            // the back of the envelope
    const flap = [[4.5, 11], [18, apex], [31.5, 11]];
    if (open) out.push(fill(flap, C.tomato, C.tomatoP));                          // the flap's inside, behind the letter
    if (open) {                                                                     // the letter, once there's room for it
      out.push(fill(rect(8.5, top, 27.5, 27), C.teal, C.tealP));
      out.push(line([[11.5, top + 3.2], [21.5, top + 3.2]], C.navy, 1));
      out.push(line([[11.5, top + 6], [24, top + 6]], C.navy, .9));
    }
    const pocket = [[4.5, 16], [18, 23.5], [31.5, 16], [31.5, 29.5], [4.5, 29.5]];
    out.push(fill(pocket, C.mustard, C.mustardP));                                // the front, holding the letter
    out.push(line([[4.7, 16.2], [18, 23.5], [31.3, 16.2]], C.navy, .9));
    if (!open) {
      out.push(fill(flap, C.mustard, C.mustardP));
      out.push(line(flap, C.navy, 1.1));
      const s = 1 - clamp01(t * 3);                                               // the seal shrinks away as it opens
      if (s > .05) out.push(fill(circle(18, apex - 1.4, 2.3 * s, 9), C.tomato, C.tomatoP));
    } else {
      out.push(line(flap, C.navy, 1));
    }
    out.push(line(rect(4.5, 11, 31.5, 29.5).concat([[4.5, 11]]), C.navy, 1.1));
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
  // on hover the dot of the i pops up as a mustard blob and a little notification badge pops onto the corner
  linkedin(t) {
    const g = ease(t), popped = g > .2;
    const holes = [
      rect(10.4, 15.4, 14.2, 26.6),
      [[16.4, 26.6], [16.4, 15.4], [20, 15.4], [20, 17], [21.5, 15.6], [23.6, 15.2], [25.6, 16], [26.7, 18.2], [26.8, 26.6], [23.2, 26.6],
        [23.2, 20.3], [22.6, 19.1], [21.3, 19.1], [20.3, 20], [20.1, 26.6]],
    ];
    if (!popped) holes.push(circle(12.3, 11.4, 2.2, 8));
    const sq = roundRect(5.5, 5.5, 30.5, 30.5, 4.6);
    const out = [fill(sq, C.blue, C.blueP, holes), line(sq.concat([sq[0]]), C.navy, 1)];
    if (popped) {
      const dot = circle(12.3, 11.6 - 3 * g, 2.5 + .8 * g, 10);
      out.push(fill(dot, C.mustard, C.mustardP), line(dot.concat([dot[0]]), C.navy, 1));
    }
    const b = backOut(clamp01((g - .3) / .7));
    if (b > .02) out.push(fill(circle(29.2, 6.8, 4.4 * b, 12), C.tomato, C.tomatoP));
    return out;
  },
  // Home: a little house. On hover the door swings open, the window lights up, and smoke curls from the chimney.
  house(t) {
    const g = ease(t), out = [];
    out.push(fill(rect(22.6, 7.6, 26.2, 15), C.tomato, C.tomatoP));          // chimney, behind the roof
    out.push(fill(rect(7.6, 18, 28.4, 31), C.mustard, C.mustardP));          // walls
    out.push(fill([[3.6, 19], [18, 6.6], [32.4, 19]], C.teal, C.tealP));     // roof
    out.push(fill(rect(15.4, 23, 20.6, 31), C.navy, C.lilacP));              // the dark doorway
    out.push(fill(rect(15.4, 23, lerp(20.6, 16.6, backOut(g)), 31), C.tomato, C.tomatoP));   // the door swings in
    const lit = g > .35, win = rect(22.2, 21.4, 26, 25.2);
    out.push(fill(win, lit ? C.mustard : C.navy, lit ? C.mustardP : C.blueP));
    out.push(line([[3.2, 19.4], [18, 6.6], [32.8, 19.4]], C.navy, 1.3));
    out.push(line([[7.6, 19], [7.6, 31], [28.4, 31], [28.4, 19]], C.navy, 1.1));
    out.push(line([[2.8, 31.2], [33.2, 31.2]], C.navy, .9));
    // smoke: three puffs rising and swelling while the house is alive
    if (g > .05) {
      const now = performance.now() / 1600;
      for (let i = 0; i < 3; i++) {
        const s = (now + i / 3) % 1, r = (.9 + s * 1.7) * g * (1 - s * .35);
        if (r > .3) out.push(fill(circle(24.4 + s * 3.2 + Math.sin(s * 6) * .6, 6 - s * 6.4, r, 8), C.lilac, C.lilacP));
      }
    }
    return out;
  },
  // Experience: a briefcase. On hover a page peeks up out of it, the case hops, and the clasp catches the light.
  briefcase(t) {
    const g = ease(t), hop = -Math.sin(Math.PI * clamp01(t * 1.25)) * 1.6, out = [];
    const peek = lerp(14, 5.5, backOut(clamp01((g - .15) / .85)));
    out.push(fill(rect(11, peek, 25, 20), C.teal, C.tealP));                 // the page, behind the case
    out.push(line([[13.6, peek + 3], [21, peek + 3]], C.navy, 1));
    out.push(line([[13.6, peek + 5.6], [19, peek + 5.6]], C.navy, .9));
    const body = roundRect(4.5, 13.5 + hop, 31.5, 31 + hop, 3.4);
    out.push(fill(body, C.tomato, C.tomatoP));
    out.push(line(body.concat([body[0]]), C.navy, 1.1));
    out.push(line([[13.4, 13.6 + hop], [13.4, 9.6 + hop - g * .8], [22.6, 9.6 + hop - g * .8], [22.6, 13.6 + hop]], C.navy, 1.4)); // handle
    out.push(line([[4.8, 20.6 + hop], [31.2, 20.6 + hop]], C.navy, .9));       // the seam of the lid
    const clasp = rect(16, 18.6 + hop, 20, 22.8 + hop);
    out.push(fill(clasp, g > .3 ? C.mustard : C.navy, C.mustardP));
    return out;
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
// each icon's own crayon, used for its leader line
const INK = { github: C.navy, email: C.tomato, linkedin: C.blue };
// how fast a drawing settles back once the pointer leaves, per drawing (per tick); LinkedIn's dot and badge
// tuck away quickly rather than hanging around
const SETTLE = { linkedin: .34 };
const DOT = '#b4bcc6';                  // the leader's resting dots, a light grey like the sky's small dots
const STEP = 8;                         // one dot per sky cell width
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
  const shown = +el.dataset.size || SHOWN;   // a doodle can ask to be drawn smaller (data-size, css px)
  const canvas = document.createElement('canvas');
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 3);
    canvas.width = canvas.height = Math.round(shown * dpr);
  };
  size();

  // the leader line in this row
  const ruleEl = el.closest('li')?.querySelector('.rule');
  const rule = ruleEl ? document.createElement('canvas') : null;
  const rctx = rule?.getContext('2d');
  let rw = 0;
  if (rule) {
    ruleEl.appendChild(rule);
    new ResizeObserver(() => paintRule(frame)).observe(ruleEl);
  }
  function paintRule(f) {
    if (!rctx) return;
    // keep the canvas matched to the line's width
    const w = ruleEl.clientWidth;
    if (w !== rw || rule.width !== Math.round(w * dpr)) { rw = w; rule.width = Math.round(rw * dpr); rule.height = Math.round(12 * dpr); }
    if (rw < STEP) return;
    const j = (k, a) => (hash(f, k, 77) - .5) * 2 * a;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, rw, 12);
    const n = Math.floor((rw - 10) / STEP), reach = ease(t) * (n + 1), ink = PAL[INK[el.dataset.doodle] ?? C.navy];
    rctx.lineCap = 'round';
    for (let i = 0; i <= n; i++) {
      const x = 3 + i * STEP;
      if (i < reach - .5) {
        // crayon dash, two waxy passes
        rctx.strokeStyle = ink;
        for (let pass = 0; pass < 2; pass++) {
          rctx.lineWidth = pass ? .7 : 1.35; rctx.globalAlpha = pass ? .5 : .9;
          rctx.beginPath(); rctx.moveTo(x - 2.6 + j(i * 4 + pass, .5), 6 + j(i * 4 + 2 + pass, .55)); rctx.lineTo(x + 2.6 + j(i * 4 + 1 + pass, .5), 6 + j(i * 4 + 3 + pass, .55)); rctx.stroke();
        }
        rctx.globalAlpha = 1;
      } else {
        rctx.fillStyle = DOT;
        rctx.fillRect(x - .75, 5.25, 1.5, 1.5);
      }
    }
    // the arrow rides the front of the dash and comes to rest at the end
    if (t > .02) {
      const x = Math.min(3 + (reach - .5) * STEP + 3, rw - 3);
      rctx.strokeStyle = ink; rctx.lineWidth = 1.35; rctx.globalAlpha = clamp01(t * 3);
      rctx.beginPath(); rctx.moveTo(x - 3.2 + j(90, .4), 2.6 + j(91, .4)); rctx.lineTo(x + j(92, .3), 6); rctx.lineTo(x - 3.2 + j(93, .4), 9.4 + j(94, .4)); rctx.stroke();
      rctx.globalAlpha = 1;
    }
  }

  let t = 0, target = 0, frame = 0, visible = true, timer = 0;

  let paint = function () {
    const f = frame, j = (k, a = .35) => (hash(f, k, 31) - .5) * 2 * a;   // per-drawing jitter
    const k = dpr * shown / SIZE;
    ctx.setTransform(k, 0, 0, k, 0, 0);
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
  };

  const paintIcon = paint;
  paint = () => { paintIcon(); paintRule(frame); };

  // On twos while alive, a slow shimmer at rest, nothing when off screen.
  function tick() {
    timer = 0;
    if (!visible) return;
    const alive = t > 0 || target > 0;
    if (reduced) { t = target; paint(); return; }
    t = target > t ? Math.min(1, t + .22) : Math.max(0, t - (SETTLE[el.dataset.doodle] ?? .16));
    frame++;
    paint();
    timer = setTimeout(tick, alive ? BOIL_MS : BOIL_MS * 3.2);
  }
  const wake = () => { if (timer) clearTimeout(timer); tick(); };

  const row = el.closest('li, button') || el;
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
