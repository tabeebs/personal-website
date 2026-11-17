// The tab icon: a little terminal window with a big >_ prompt, drawn on a 32x32 pixel grid in the crayon
// palette. The shape never changes; every eight frames (one second, on twos) the prompt takes the next crayon
// ink, flashing its pastel for a frame as it switches, and the window's three dots rotate through the inks
// with it. The cursor blinks and the waxy grain boils like everything else on the page.
// Pure: no DOM, so the page animates it (favicon.js) and a Node script prints the static favicon.png from it.
import { PAL, C, hash } from './crayon.js';

export const SIZE = 32;
export const FRAMES = 48;                 // six inks, eight frames each
export const STILL = 1;                   // the frame used for favicon.png: prompt inked, cursor on

const rgb = (i) => { const h = PAL[i]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
const INKS = [[C.tomato, C.tomatoP], [C.mustard, C.mustardP], [C.grass, C.grassP], [C.teal, C.tealP], [C.blue, C.blueP], [C.lilac, C.lilacP]]
  .map(([a, b]) => [rgb(a), rgb(b)]);
const ink = (i) => INKS[((i % 6) + 6) % 6];
const NAVY = rgb(C.navy), BAR = [61, 75, 125], WHITE = [255, 255, 255], BLACK = [0, 0, 0];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const circ = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function rr(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const qx = Math.max(x0 + r - x, 0, x - (x1 - r)), qy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return qx * qx + qy * qy <= r * r;
}
// waxy grain: short vertical strokes, re-rolled every frame
function grain(c, x, y, f, amt) {
  const h = hash(x * 7 + 1, Math.floor((y + hash(x, 9) * 4) / 3), f);
  if (h < .2) return mix(c, BLACK, amt * .3);
  if (h > .8) return mix(c, WHITE, amt);
  return c;
}

const tile = (x, y) => rr(x, y, 0, 0, 32, 32, 6);
const bar = (x, y) => y < 6.5;
const DOTS = [5, 9.5, 14];
const chevron = (x, y) => { const d = Math.abs(y - 18), x0 = 4.8 + (5.5 - d) * 1.05; return y > 12 && y < 24 && d <= 5.5 && x > x0 && x < x0 + 3.2; };
const cursor = (x, y) => x > 15 && x < 25 && y > 21 && y < 24;

// RGBA pixels for frame f
export function frame(f) {
  f = ((f % FRAMES) + FRAMES) % FRAMES;
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  const step = Math.floor(f / 8), [a, b] = ink(step), prompt = f % 8 === 0 ? b : a;
  const blink = Math.floor(f / 2) % 2 === 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const px = x + .5, py = y + .5;
    if (!tile(px, py)) continue;
    let c, amt = .12;
    const dot = DOTS.findIndex((cx) => circ(px, py, cx, 3.3, 1.5));
    if (dot >= 0) { c = ink(step + dot)[0]; amt = 0; }
    else if (bar(px, py)) c = BAR;
    else if (chevron(px, py) || (blink && cursor(px, py))) { c = prompt; amt = .2; }
    else c = NAVY;
    const g = amt ? grain(c, x, y, f, amt) : c, i = (y * SIZE + x) * 4;
    out[i] = g[0]; out[i + 1] = g[1]; out[i + 2] = g[2]; out[i + 3] = 255;
  }
  return out;
}
