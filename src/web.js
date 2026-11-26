// "the web": hovering (or focusing, or tapping) the words opens them. The rest of the page goes quiet behind a
// blur, and my profiles pop up out of the words, from the middle outwards. Like a dock, their sizes follow the pointer
// as it moves: the one under it swells and says its name, and the others shrink back.
// Source for build/web.js: rebuild with `npm run build` after editing.

const web = document.querySelector('.web');
if (web) {
  const btn = web.querySelector('.web-btn');
  const row = web.querySelector('.socials');
  const icons = [...row.querySelectorAll('.social')];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // they fan out from the middle: each starts tucked in at the centre of the row (--from) and springs out to its
  // place, the middle one first, then each pair either side of it together
  const mid = (icons.length - 1) / 2;
  icons.forEach((a, i) => {
    a.style.setProperty('--i', Math.abs(i - mid));
    a.style.setProperty('--from', `${(mid - i) * 58}px`);   // one resting icon plus the gap, per step from the middle
    a.style.setProperty('--tint', a.dataset.tint);
  });

  let open = false, closer = 0, openedAt = 0;
  const set = (on) => {
    clearTimeout(closer);
    if (on === open) return;
    open = on;
    if (on) {
      openedAt = performance.now();
      // the row is centred over the words alone, not the globe beside them
      const words = web.querySelector('.web-label');
      row.style.left = `${words.offsetLeft + words.offsetWidth / 2}px`;
    }
    root.classList.toggle('web-open', on);
    btn.setAttribute('aria-expanded', on);
    if (!on) swell(null);
  };
  // leaving closes after a moment, so a pointer crossing the small gap to the icons doesn't drop them
  const later = () => { clearTimeout(closer); closer = setTimeout(() => set(false), 160); };

  web.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') set(true); });
  web.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') later(); });
  web.addEventListener('focusin', () => set(true));
  web.addEventListener('focusout', (e) => { if (!web.contains(e.relatedTarget)) later(); });
  // touch has no hover: a tap on the words toggles them, and a tap anywhere else closes them. (A tap or a press
  // focuses the button first, which has just opened it, so a click right after an opening leaves it open.)
  // A mouse already opened it by hovering, so its click changes nothing.
  let pressedBy = '';
  btn.addEventListener('pointerdown', (e) => { pressedBy = e.pointerType; });
  btn.addEventListener('click', () => {
    if (pressedBy !== 'mouse') set(!open || performance.now() - openedAt < 400);
    pressedBy = '';
  });
  document.addEventListener('pointerdown', (e) => { if (open && !web.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    if (web.contains(document.activeElement)) document.activeElement.blur();
    set(false);
  });

  // The dock: every icon's size follows how far it is from the pointer, continuously, so even small moves
  // within one icon shift the sizes. Right under the pointer an icon swells; further off it shrinks below its
  // resting size, so the one you're on stands out and the others step back. Sizes are eased every frame towards
  // those targets, so it stays quick and smooth.
  const BIG = 1.4, SMALL = .8, SIGMA = 30;   // largest and smallest size (x the resting 54px), and the falloff, px
  const cur = icons.map(() => 1);
  let px = null, raf = 0, then = 0;
  const goal = (a) => {
    if (px == null) return 1;
    const r = a.getBoundingClientRect(), d = px - (r.left + r.width / 2);
    return SMALL + (BIG - SMALL) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
  };
  function swell(x) {
    px = x ?? null;
    if (reduced) { icons.forEach((a) => a.style.setProperty('--s', goal(a).toFixed(3))); return; }
    if (!raf) { then = performance.now(); raf = requestAnimationFrame(step); }
  }
  function step(now) {
    const k = 1 - Math.exp(-(now - then) / 45); then = now;   // closes most of the gap in under a tenth of a second
    let busy = false;
    icons.forEach((a, i) => {
      const g = goal(a);
      cur[i] += (g - cur[i]) * k;
      if (Math.abs(g - cur[i]) < .002) cur[i] = g; else busy = true;
      a.style.setProperty('--s', cur[i].toFixed(4));
    });
    raf = busy ? requestAnimationFrame(step) : 0;
  }
  row.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') swell(e.clientX); });
  row.addEventListener('pointerleave', () => swell(null));
  // with the keyboard, the focused icon swells as if the pointer sat on its middle
  icons.forEach((a) => {
    a.addEventListener('focus', () => { if (a.matches(':focus-visible')) { const r = a.getBoundingClientRect(); swell(r.left + r.width / 2); } });
    a.addEventListener('blur', () => swell(null));
  });
}

// The underline, drawn by hand: a run of little loops, like a phone cord, kept within the words. The light coil
// is drawn in once the swash under "shaf" has swept in and UNSW's crest has shone (src/hello.js says when) and this line has risen into
// place, and then stays. Opening "the
// web" traces a dark coil over it, along the same path; closing it rubs the dark one gently back out, leaving the
// light one as it was.
const label = document.querySelector('.web-label');
if (label) {
  const NS = 'http://www.w3.org/2000/svg';
  const H = 14;   // the drawing's height (it hangs just under the words)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f = (n) => n.toFixed(2);
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // a stretched cycloid: it loops because it swings round wider than it moves along
  const coil = (w) => {
    const A = .72, B = 2.1, y = 4.6, T = (w - 1) / A, pts = [];
    for (let t = 0; t <= T; t += .22) pts.push(`${f(A * t - B * Math.sin(t) + .5)} ${f(y - B * .85 * Math.cos(t))}`);
    return `M${pts.join(' L')}`;
  };

  let svg = null;
  const draw = () => {
    // drawn for 16px text, and scaled with the words' size, so its loops (and stroke) grow with them
    const k = parseFloat(getComputedStyle(label).fontSize) / 16, w = label.offsetWidth / k, d = coil(w);
    svg = el('svg', { class: 'web-ink', 'aria-hidden': 'true', width: (w + 4) * k, height: H * k, viewBox: `-2 0 ${w + 4} ${H}` });
    // the light coil, then the dark one over it: the very same path
    for (const layer of ['base', 'over']) svg.append(el('path', { class: `tr ${layer}`, d, pathLength: 1 }));
    label.append(svg);
    if (reduced) { svg.classList.add('shown'); return; }
    svg.getBoundingClientRect();   // so the light coil draws in, rather than just appearing
    svg.classList.add('shown');
  };
  // it waits for the font too, so it fits the words, and for its own line to rise into place (src/intro.js): like
  // each step of the opening (src/hello.js), it starts a beat after that has landed, once it's 80% through
  const landed = (a) => a.ready.then(() => {
    const { delay, activeDuration } = a.effect.getComputedTiming();
    return new Promise((r) => setTimeout(r, (delay + activeDuration * .8 - (a.currentTime ?? 0)) / (a.playbackRate || 1)));
  }, () => {});
  // and the opening's next line waits for the coil in turn (src/hello.js): this settles once it's 80% drawn in (its
  // .8s in style.css), a beat later
  window.__coiled = Promise.all([window.__unswed || window.__swashed, document.fonts?.ready])
    .then(() => Promise.all(label.closest('p').getAnimations().map(landed)))
    .then(() => new Promise((r) => setTimeout(() => { draw(); setTimeout(r, reduced ? 0 : 800 * .8 + 60); }, reduced ? 0 : 60)));
}
