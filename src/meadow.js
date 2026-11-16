// Rain and the meadow.
//
// createRain: rain falling through a glyph grid. It falls from wherever the sky is clicked (hold to keep it
// raining, drag to move the shower), and every so often from one of the clouds by itself, all the way down the
// page to the meadow; every drop that lands reports where, so the meadow can drink it.
//
// createMeadow: a strip of crayon-hatched ASCII grass and flowers at the bottom of the page, drawn in the same
// 8x12 tiles as the sky from a small texture this module fills every frame (one texel per glyph cell, row 0 is
// the ground row). Flowers bloom where the sky's rain lands on them, stay open a while, then close back into
// buds. Brushing the pointer through the meadow bends the grass and makes the flowers lean.
import { GI, HATCH, C, hash } from './crayon.js';

export const MROWS = 9;           // meadow rows above (and including) the ground row

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- rain ----------
// stopAt(x) gives the y where a drop ends; onLand(x, y, t) is told when it does.
export function createRain({ CW, CH, stopAt, onLand }) {
  let cols = 1, rows = 1;
  let rain = new Float32Array(1), glyph = new Uint8Array(1);
  const drops = [], queue = [];

  function resize(c, r) { cols = c; rows = r; rain = new Float32Array(c * r); glyph = new Uint8Array(c * r); }
  function drop(x, y, t, vy = 150 + Math.random() * 110) {
    const stop = stopAt(x);
    if (y >= stop - 4) return;
    drops.push({ x, y, vy, stop, born: t });
  }
  // a short burst, spread over a moment
  function burst(x, y, t, n = 18, spread = 38) {
    for (let i = 0; i < n; i++) queue.push({ at: t + Math.random() * .7, x: x + (Math.random() * 2 - 1) * spread, y: y + Math.random() * 16 - 4 });
  }
  function update(t, dt) {
    rain.fill(0);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= t) { drop(queue[i].x, queue[i].y, t); queue.splice(i, 1); }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy = Math.min(520, d.vy + 640 * dt);
      d.y += d.vy * dt;
      if (d.y >= d.stop) { onLand?.(d.x, d.stop, t); drops.splice(i, 1); continue; }
      const col = Math.floor(d.x / CW), row = Math.floor(d.y / CH);
      if (col < 0 || col >= cols) continue;
      const fadeIn = clamp((t - d.born) / .2);
      const stamp = (r, v, g) => { if (r >= 0 && r < rows) { const j = r * cols + col; v *= fadeIn; if (v > rain[j]) { rain[j] = v; glyph[j] = g; } } };
      stamp(row, 1, d.vy > 300 ? GI['|'] : GI["'"]);
      stamp(row - 1, d.vy > 300 ? .55 : .3, GI["'"]);
      if (d.vy > 420) stamp(row - 2, .22, GI["'"]);
    }
  }
  return {
    resize, drop, burst, update,
    get rain() { return rain; }, get glyph() { return glyph; },
    get busy() { return drops.length > 0 || queue.length > 0; },
  };
}

// ---------- meadow ----------
// Flower kinds. Petal colours are (ink, fill) pairs from the shared palette.
const PETALS = [
  [C.lilac, C.lilacP], [C.lilac, C.lilacP], [C.mustard, C.mustardP], [C.teal, C.tealP],
  [C.tomato, C.tomatoP], [C.pink, C.pinkP], [C.mustard, C.mustardP],
];
const KINDS = ['daisy', 'daisy', 'daisy', 'tulip', 'tulip', 'spike', 'sprig'];

export function createMeadow({ CW, CH, reduced = false }) {
  let cols = 1;
  let base = -1, x0 = 0, x1 = 0, key = '';
  let cells = new Uint8Array(4 * MROWS);
  let flowers = [], grassLean = new Float32Array(1);
  const splashes = [];
  let lastMove = null, now = 0;

  const groundY = () => base * CH;   // top of the ground row, in this canvas's px

  function resize(c, r) {
    cols = c;
    cells = new Uint8Array(cols * MROWS * 4);
    grassLean = new Float32Array(cols);
    key = '';
  }

  // Seeded, so the meadow is the same on every visit.
  function plant() {
    flowers = [];
    const c0 = Math.ceil(x0 / CW) + 3, c1 = Math.floor(x1 / CW) - 3;
    let c = c0 + Math.floor(hash(7, c0) * 3);
    for (let i = 0; c <= c1; i++) {
      const r = (k) => hash(i, k, 4242);
      const kind = KINDS[Math.floor(r(1) * KINDS.length)];
      const [ink, fill] = PETALS[Math.floor(r(2) * PETALS.length)];
      const h = kind === 'spike' ? 2 + Math.floor(r(3) * 3) : kind === 'sprig' ? 1 + Math.floor(r(3) * 2) : 1 + Math.floor(r(3) * 4.6);
      flowers.push({ col: c, h, kind, ink, fill, b: 0, target: 0, until: 0, lean: 0, leaf: r(4) < .7 ? (r(5) < .5 ? -1 : 1) : 0, leafAt: 1 + Math.floor(r(6) * Math.max(1, h - 1)) });
      c += 2 + Math.floor(r(7) * 4);
    }
    // a few already open when the page loads, so the meadow is never bare
    flowers.forEach((f, i) => {
      if (hash(i, 99) < .25) { f.b = 1; f.target = 1; f.until = now + 8 + hash(i, 98) * 30; }
    });
  }

  function setGround(row, left, right) {
    base = row; x0 = left; x1 = right;
    const k = `${row}|${Math.round(left / CW)}|${Math.round(right / CW)}|${cols}`;
    if (k !== key) { key = k; plant(); }
  }

  function water(col, t, stay = 16) {
    for (const f of flowers) {
      if (Math.abs(f.col - col) <= 2) { f.target = 1; f.until = Math.max(f.until, t + stay + Math.random() * 12); }
    }
  }
  // a raindrop from the sky landing at x: a little splash, and the flowers around it drink
  function land(x, t) {
    if (base < 0) return;
    const col = Math.floor(x / CW);
    splashes.push({ col, k: 1 + Math.floor(Math.random() * 2), ttl: .32 });
    water(col, t);
  }

  // ---- pointer, in this canvas's px ----
  function move(x, y) {
    if (lastMove && base >= 0) {
      const dx = x - lastMove.x, gy = groundY();
      // brushing through the meadow: grass bends and flowers lean the way the pointer moved
      if (y > gy - MROWS * CH - 10 && y < gy + CH * 2 && Math.abs(dx) > .5) {
        const push = clamp(dx / 14, -1, 1);
        const cx = x / CW;
        for (let c = Math.max(0, Math.floor(cx - 5)); c <= Math.min(cols - 1, Math.ceil(cx + 5)); c++) {
          const f = 1 - Math.abs(c + .5 - cx) / 5.5;
          if (f > 0) grassLean[c] = clamp(grassLean[c] + push * f * .9, -1.6, 1.6);
        }
        for (const fl of flowers) {
          const d = Math.abs(fl.col + .5 - cx);
          if (d < 5) fl.lean = clamp(fl.lean + push * (1 - d / 5) * .8, -1.5, 1.5);
        }
      }
    }
    lastMove = { x, y };
  }
  function leave() { lastMove = null; }

  // ---- drawing into the cell texture ----
  function put(col, k, glyph, ink, fill, strength) {
    if (col < 0 || col >= cols || k < 0 || k >= MROWS) return;
    const i = (k * cols + col) * 4;
    cells[i] = glyph; cells[i + 1] = ink; cells[i + 2] = fill; cells[i + 3] = Math.round(clamp(strength) * 255);
  }

  function drawFlower(f) {
    const lean = Math.abs(f.lean) > .55 ? Math.sign(f.lean) : 0;
    const top = f.h;                                    // the stem runs from row 1 to row h
    // stem: navy, as in the reference; its top row tips over when the flower leans
    for (let k = 1; k <= top; k++) {
      const g = k === top && lean ? (lean > 0 ? GI['/'] : GI['\\']) : GI['|'];
      put(f.col, k, g, C.navy, 0, .78);
    }
    if (f.leaf && f.h >= 2) put(f.col + f.leaf, f.leafAt, f.leaf < 0 ? GI['\\'] : GI['/'], C.teal, C.tealP, .85);
    const hc = f.col + lean, hk = top + 1, b = f.b;
    const P = (dc, dk, s = 1) => put(hc + dc, hk + dk, HATCH, f.ink, f.fill, s);
    if (f.kind === 'sprig') {
      // forget-me-nots: a scatter of little stars
      const s = smooth(0, .6, b);
      put(hc, hk, b < .2 ? GI['.'] : GI['*'], f.ink, 0, .55 + .45 * s);
      if (b > .35) put(hc - 1, hk - 1, GI['*'], f.ink, 0, s);
      if (b > .6) put(hc + 1, hk, GI['*'], f.ink, 0, s);
      return;
    }
    if (b < .22) { put(hc, hk, b < .1 ? GI["'"] : GI.o, f.ink, 0, .8); return; }   // a closed bud
    const s = smooth(.22, .7, b);
    if (f.kind === 'spike') {
      // a lupin: a column of hatched petals that fills upward
      P(0, 0, s); if (b > .45) P(0, 1, s); if (b > .7) P(0, 2, s);
      if (b > .55) { put(hc - 1, hk, GI['.'], f.ink, 0, s); put(hc + 1, hk + 1, GI['.'], f.ink, 0, s); }
      return;
    }
    if (f.kind === 'tulip') {
      // a cup that opens into two petal tips
      if (b < .5) { put(hc - 1, hk, GI['('], f.ink, 0, s); P(0, 0, s); put(hc + 1, hk, GI[')'], f.ink, 0, s); return; }
      P(-1, 0, s); P(0, 0, s); P(1, 0, s);
      P(-1, 1, smooth(.6, .95, b)); P(1, 1, smooth(.6, .95, b));
      return;
    }
    // daisy: opens from a bud to a round hatched head with a dark eye; tall ones open wide
    const eye = f.fill === C.mustardP ? C.tomatoP : C.mustardP;
    if (b < .45) { put(hc - 1, hk, GI['('], f.ink, 0, s); put(hc, hk, GI.o, C.navy, eye, s); put(hc + 1, hk, GI[')'], f.ink, 0, s); return; }
    const big = f.h >= 3, s2 = smooth(.55, .85, b), s3 = smooth(.75, 1, b);
    if (big) {
      P(-1, 1, s); put(hc, hk + 1, GI.o, C.navy, eye, 1); P(1, 1, s);
      P(0, 0, s); P(0, 2, s2);
      P(-1, 0, s2); P(1, 0, s2); P(-1, 2, s3); P(1, 2, s3);
      P(-2, 1, s3); P(2, 1, s3);
      return;
    }
    P(-1, 0, s); put(hc, hk, GI.o, C.navy, eye, 1); P(1, 0, s);
    P(0, 1, s2); P(-1, 1, s3 * .9); P(1, 1, s3 * .9);
  }

  function update(t, dt) {
    now = t;
    cells.fill(0);
    if (base < 0) return;

    // flowers open toward their target and close again once their water runs out
    for (const f of flowers) {
      if (f.target === 1 && t > f.until) f.target = 0;
      const rate = f.target > f.b ? 1 / 1.15 : 1 / 2.4;
      f.b = f.target > f.b ? Math.min(f.target, f.b + rate * dt) : Math.max(f.target, f.b - rate * dt);
      if (reduced) f.b = f.target;
      f.lean *= Math.exp(-dt * 2.2);
    }

    // grass: a ground row of green tiles, tufts on top, bending where the pointer brushed
    const c0 = Math.max(0, Math.floor(x0 / CW)), c1 = Math.min(cols - 1, Math.ceil(x1 / CW));
    for (let c = c0; c <= c1; c++) {
      const cx = (c + .5) * CW, w = smooth(x0, x0 + 64, cx) * smooth(x1, x1 - 64, cx);
      if (w <= 0) continue;
      grassLean[c] *= Math.exp(-dt * 2.6);
      const lean = grassLean[c], hv = hash(c, 17);
      const bent = Math.abs(lean) > .3 ? (lean > 0 ? GI['/'] : GI['\\']) : 0;
      put(c, 0, hv < .5 ? HATCH : hv < .75 ? GI["'"] : GI[','], C.grass, hv < .8 ? C.grassP : 0, .8 * w);
      if (hash(c, 18) < .42 * w) put(c, 1, bent || (hash(c, 19) < .5 ? GI["'"] : hash(c, 19) < .8 ? GI[','] : GI['"']), C.grass, 0, .75 * w);
      else if (bent && hash(c, 18) < .7 * w) put(c, 1, bent, C.grass, 0, .5 * w);
    }
    for (const f of flowers) drawFlower(f);

    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.ttl -= dt;
      if (s.ttl <= 0) { splashes.splice(i, 1); continue; }
      put(s.col, s.k, s.ttl > .18 ? GI['.'] : GI[','], C.rain, 0, clamp(s.ttl / .2));
    }
  }

  return {
    resize, setGround, update, move, leave, land,
    get base() { return base; },
    get cells() { return cells; },
    debug: () => ({ flowers, base, x0, x1 }),
  };
}
