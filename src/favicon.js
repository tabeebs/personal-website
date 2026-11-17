// Animates the tab icon. Chrome and Safari don't animate GIF favicons, so like zirui.ca this draws every frame
// to a canvas once, keeps them as PNG data URLs, and swaps the icon's href on twos. The HTML links favicon.png
// (a still of the same drawing) so the icon is right before this runs, without JS, and under reduced motion.
// Browsers slow timers in background tabs to about once a second, so a tab you're not looking at ticks slower.
import { BOIL_MS } from './crayon.js';
import { SIZE, FRAMES, frame } from './favicon-art.js';

const link = document.querySelector('link[rel~="icon"]');
if (link && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const urls = Array.from({ length: FRAMES }, (_, f) => {
    ctx.putImageData(new ImageData(frame(f), SIZE, SIZE), 0, 0);
    return canvas.toDataURL('image/png');
  });
  let f = 0;
  setInterval(() => { link.href = urls[f]; f = (f + 1) % FRAMES; }, BOIL_MS);
}
