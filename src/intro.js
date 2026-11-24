// The opening sequence, so the page arrives in order instead of all at once: it opens inside a cloud that parts
// from the greeting outward as the camera pulls back (src/sky.js), the card opens out, "kia ora!" drops in, and
// only once it has landed does the line under it rise, then the links; the ground surfaces from below.
// The timeline starts when the sky draws its first frame (src/sky.js calls skyReady), or after a moment anyway.
// Visitors who prefer reduced motion get the page as it is. Loaded as a plain script in <head>, so the page is
// hidden before its first paint.
// Source for build/intro.js: rebuild with `npm run build` after editing.
(() => {
  const LETTERS = 700;   // when "kia ora!" drops in, ms after the start (style.css times the rest around it)
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = (window.__intro = { on: !calm, t0: 0, letters: null, skyReady() {} });
  if (calm) return;
  root.dataset.intro = '';
  let started = false, letGo;
  intro.letters = new Promise((r) => { letGo = r; });
  const go = () => {
    if (started) return;
    started = true;
    intro.t0 = performance.now() / 1000;
    root.classList.add('intro-go');
    setTimeout(() => { root.classList.add('intro-letters'); letGo(); }, LETTERS);
    // everything has arrived: drop the sequence's styles, so each piece is just itself again
    setTimeout(() => { delete root.dataset.intro; root.classList.remove('intro-go', 'intro-letters'); intro.on = false; }, 4200);
  };
  intro.skyReady = go;
  setTimeout(go, 2000);
})();
