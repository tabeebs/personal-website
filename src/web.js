// "the web": hovering (or focusing, or tapping) the words opens them. The rest of the page goes quiet behind a
// blur, and my profiles pop up out of the words, one after another. Like a dock, their sizes follow the pointer
// as it moves: the one under it swells and says its name, and the others shrink back.
// Source for build/web.js: rebuild with `npm run build` after editing.

const web = document.querySelector('.web');
if (web) {
  const btn = web.querySelector('.web-btn');
  const row = web.querySelector('.socials');
  const icons = [...row.querySelectorAll('.social')];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  icons.forEach((a, i) => { a.style.setProperty('--i', i); a.style.setProperty('--tint', a.dataset.tint); });

  let open = false, closer = 0, openedAt = 0;
  const set = (on) => {
    clearTimeout(closer);
    if (on === open) return;
    open = on;
    if (on) openedAt = performance.now();
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
  const BIG = 1.4, SMALL = .8, SIGMA = 30;   // largest and smallest size (x the resting 48px), and the falloff, px
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
