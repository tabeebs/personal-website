// Frosted glass tabs, top right of the panel: Home and Experience.
// Follows the lens on the Seed Data dashboard tabs (SeedData/app/tabs.js): the selected tab sits under a thick
// clear lens that refracts what's beneath its rim. Here the lens runs on springs, so it slides with a stretch,
// lands with a wobble, swells when you grab it, and can be dragged from tab to tab like a slider. Hovering a tab
// raises a bubble of frost under it, wakes its doodle, and a little tinted label bounces over to name it.
// Source for build/tabs.js: rebuild with `npm run build` after editing.

const nav = document.querySelector('.tabs');
const tabs = nav ? [...nav.querySelectorAll('[role="tab"]')] : [];
const lens = nav?.querySelector('.lens');
const body = lens?.querySelector('.lens-body');
const tip = document.querySelector('.tip');
const feMap = document.getElementById('lens-map');
const feDisp = document.getElementById('lens-disp');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const names = tabs.map((t) => t.dataset.view);
let current = null;

// ---- refraction ----
// A displacement map for a pill of the lens's size: near the rim the glass bends what's beneath it outward,
// across the middle it magnifies a touch. Red/green hold the x/y shift.
const BEND = 16;
const canBend = !!window.chrome && CSS.supports('backdrop-filter', 'url(#lens-refract)');
let mapKey = '';
function refract() {
  const w = lens.offsetWidth, h = lens.offsetHeight;
  if (!canBend || !feMap || !w || !h) return;
  const key = `${w}x${h}`;
  if (key === mapKey) return;
  mapKey = key;
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = w; cv.height = h;
  const img = g.createImageData(w, h), r = h / 2, cx = w / 2, cy = h / 2, rim = Math.min(11, r * .7);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + .5 - cx, ox = Math.max(Math.abs(px) - (cx - r), 0) * Math.sign(px), oy = y + .5 - cy;
    const dist = Math.hypot(ox, oy), inside = r - dist;
    let dx = 0, dy = 0;
    if (inside > 0) {
      const k = inside < rim ? (1 - inside / rim) ** 2 : 0, nx = dist ? ox / dist : 0, ny = dist ? oy / dist : 0;
      dx = nx * k * .9 - px / cx * .12;
      dy = ny * k * .9 - oy / cy * .12;
    }
    const i = (y * w + x) * 4;
    img.data[i] = 128 + clamp(dx, -1, 1) * 127; img.data[i + 1] = 128 + clamp(dy, -1, 1) * 127;
    img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  feMap.setAttribute('href', cv.toDataURL());
  feMap.setAttribute('width', w); feMap.setAttribute('height', h);
  body.style.backdropFilter = body.style.webkitBackdropFilter = 'url(#lens-refract) saturate(1.3) brightness(1.05)';
}

// ---- the lens, on springs ----
// x is where it sits, sx/sy how it's squashed, bend how hard it refracts. Each eases toward a target on an
// underdamped spring, so it overshoots and settles; travelling fast stretches it along the way it's going.
const spring = (v, k, c) => ({ v, vel: 0, to: v, k, c });
const S = { x: spring(0, 520, 26), sx: spring(1, 420, 14), sy: spring(1, 420, 14), bend: spring(BEND, 260, 14) };
let raf = 0, last = 0;
function apply() {
  const st = clamp(Math.abs(S.x.vel) / 1500, 0, .28);
  lens.style.transform = `translateX(${S.x.v.toFixed(2)}px)`;
  body.style.transform = `scale(${(S.sx.v * (1 + st)).toFixed(4)}, ${(S.sy.v * (1 - st * .45)).toFixed(4)})`;
  feDisp?.setAttribute('scale', S.bend.v.toFixed(1));
}
function step(now) {
  const dt = Math.min(.032, Math.max(0, now - last) / 1000);
  last = now;
  let busy = false;
  for (const s of Object.values(S)) {
    s.vel += ((s.to - s.v) * s.k - s.vel * s.c) * dt;
    s.v += s.vel * dt;
    if (Math.abs(s.to - s.v) > 1e-3 || Math.abs(s.vel) > 1e-2) busy = true; else { s.v = s.to; s.vel = 0; }
  }
  apply();
  raf = busy ? requestAnimationFrame(step) : 0;
}
function go() {
  if (calm.matches) { for (const s of Object.values(S)) { s.v = s.to; s.vel = 0; } apply(); return; }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
}
const xOf = (tab) => tab.offsetLeft;

// ---- tooltip ----
let tipFor = null, tipTimer = 0;
function showTip(tab, { brief = false } = {}) {
  if (!tip) return;
  clearTimeout(tipTimer);
  const from = tipFor;
  tipFor = tab;
  const text = tip.querySelector('.tip-text');
  text.textContent = tab.getAttribute('aria-label').toLowerCase();
  // fit the label to its word, and keep it from running past the panel's right edge
  const w = text.offsetWidth + 20;
  const center = nav.offsetLeft + tab.offsetLeft + tab.offsetWidth / 2;
  const x = Math.min(center - w / 2, nav.offsetLeft + nav.offsetWidth - w);
  const wasShown = tip.classList.contains('show');
  tip.classList.toggle('snap', !wasShown);   // appearing: pop up in place; already up: glide over
  tip.style.setProperty('--y', `${nav.offsetTop + nav.offsetHeight + 8}px`);
  tip.style.setProperty('--tint', tab.dataset.tint || '#fff');
  tip.style.setProperty('--x', `${x}px`);
  tip.style.setProperty('--w', `${w}px`);
  tip.style.setProperty('--nub', `${center - x}px`);
  if (!wasShown) void tip.offsetWidth;
  tip.classList.add('show');
  if (wasShown && from && from !== tab && !calm.matches) {
    const dir = Math.sign(tabs.indexOf(tab) - tabs.indexOf(from));
    text.animate([{ opacity: 0, transform: `translateX(${dir * 8}px) scale(.9)` }, { opacity: 1, transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(.3, 1.5, .5, 1)' });
  }
  if (brief) tipTimer = setTimeout(hideTip, 1100);
}
function hideTip(delay = 0) {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { tip?.classList.remove('show'); tipFor = null; }, delay);
}

// ---- views ----
// Switching views: the old view's lines blur away quickly, all together, then the panel eases to the new view's
// height (the sky's card follows it, see sky.js), so nothing is ever left showing past the panel's edge. Growing,
// each new line arrives as the edge uncovers it. New lines slide in from the side the lens went and come into
// focus as they land. Lines are paragraphs, list rows, and anything marked .piece.
const viewsEl = document.querySelector('.views');
const pieces = (v) => [...v.querySelectorAll('.intro > *, li, .piece')];
const EASE = 'cubic-bezier(.33, 1, .68, 1)';                    // ease-out cubic: 1 - (1 - u)^3
const reach = (e) => 1 - Math.cbrt(1 - clamp(e, 0, 1));         // how far through the easing it covers fraction e
const EDGE = 34;                                                // the card reaches this far below the views (sky.js)
const OUT = 120;                                                // how long the old lines take to go, ms
let finishSwap = null;
function swap(from, to, dir, animate = true) {
  finishSwap?.();                                          // a switch still in flight lands at once
  if (!animate || calm.matches) { from.hidden = true; to.hidden = false; return; }
  const h0 = viewsEl.offsetHeight;
  // the old view leaves the flow and stays where it was, so the new one can take its place underneath
  Object.assign(from.style, { position: 'absolute', top: '0', left: '0', right: '0', pointerEvents: 'none' });
  from.setAttribute('inert', '');
  to.hidden = false;
  const h1 = to.offsetHeight, span = Math.abs(h1 - h0), grow = h1 > h0;
  const D = clamp(260 + span * .6, 300, 460);
  const top = viewsEl.getBoundingClientRect().top, box = (el) => el.getBoundingClientRect();
  const edgeAt = (y) => (span < 1 ? 0 : reach((y - h0 - EDGE) / span) * D);   // when (ms) a growing panel's edge passes y
  const anims = [];
  // the old lines go quickly, all together, so none is left hanging over the sky once the panel starts to move
  pieces(from).forEach((el) => anims.push(el.animate([
    { opacity: 1, transform: 'none', filter: 'blur(0)' },
    { opacity: 0, transform: `translateX(${-dir * 10}px)`, filter: 'blur(3px)' },
  ], { duration: OUT, easing: 'cubic-bezier(.2, 0, .4, 1)', fill: 'forwards' })));
  // shrinking waits for them to be gone; growing starts at once
  anims.push(viewsEl.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: D, delay: grow ? 0 : OUT - 10, easing: EASE, fill: 'backwards' }));
  pieces(to).forEach((el, i) => {
    const r = box(el), start = grow ? edgeAt(r.bottom - top) : 0;   // lines the edge uncovers come as it does
    anims.push(el.animate([
      { opacity: 0, transform: `translate(${dir * 18}px, 4px) scale(.98)`, filter: 'blur(4px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ], { duration: 460, delay: Math.max(90 + i * 45, start), easing: 'cubic-bezier(.2, .9, .25, 1)', fill: 'backwards' }));
  });
  let done = false;
  finishSwap = () => {
    if (done) return;
    done = true; finishSwap = null;
    anims.forEach((a) => a.cancel());
    from.hidden = true;
    from.removeAttribute('inert');
    Object.assign(from.style, { position: '', top: '', left: '', right: '', pointerEvents: '' });
  };
  Promise.all(anims.map((a) => a.finished)).then(finishSwap, () => {});
}

function select(name, { focus = false, animate = true } = {}) {
  if (!names.includes(name)) name = names[0];
  const i = names.indexOf(name), tab = tabs[i], prev = current;
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  }
  S.x.to = xOf(tab);
  if (!animate || prev === null) { S.x.v = S.x.to; S.x.vel = 0; apply(); }
  else if (prev !== name) {
    S.bend.vel += 260;                                   // the glass ripples as it moves off
    const d = tab.querySelector('.doodle');
    d?.classList.remove('hop'); void d?.offsetWidth; d?.classList.add('hop');
  }
  go();
  if (prev !== null && prev !== name) {
    const a = document.getElementById(`view-${prev}`), b = document.getElementById(`view-${name}`);
    swap(a, b, Math.sign(i - names.indexOf(prev)), animate);
  }
  current = name;
  if (focus) tab.focus();
  history.replaceState(null, '', name === names[0] ? location.pathname + location.search : `#${name}`);
}

if (nav && lens && body) {
  refract();

  // hover: its tooltip, and (doodles.js) its drawing comes alive
  let dragging = false;
  tabs.forEach((t) => {
    t.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      showTip(t);
    });
    t.addEventListener('focus', () => { if (t.matches(':focus-visible')) showTip(t); });
    t.addEventListener('blur', () => hideTip(60));
    t.addEventListener('click', () => {
      if (t.dataset.view === current) {
        // pressing the open tab presses into the glass
        S.sx.vel -= 2.2; S.sy.vel -= 2.2; go();
      }
      select(t.dataset.view);
    });
  });
  nav.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hideTip(90);
  });

  // drag the lens between the tabs, like a slider: it swells while held and snaps to the nearest tab on release
  let down = null;
  nav.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = { id: e.pointerId, x: e.clientX, from: S.x.to, onLens: e.target.closest('.tab')?.dataset.view === current };
    if (down.onLens) { S.sx.to = S.sy.to = 1.1; S.bend.to = BEND * 1.6; go(); }
  });
  nav.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    if (!dragging && Math.abs(dx) > 5 && down.onLens) {
      dragging = true;
      nav.setPointerCapture(e.pointerId);    // the release lands on the bar, so it doesn't count as a click
      nav.classList.add('dragging');
    }
    if (!dragging) return;
    const min = xOf(tabs[0]), max = xOf(tabs[tabs.length - 1]), raw = down.from + dx;
    // past either end it resists, like pulling on something elastic
    S.x.to = raw < min ? min - Math.sqrt(min - raw) * 1.6 : raw > max ? max + Math.sqrt(raw - max) * 1.6 : raw;
    const near = tabs.reduce((a, t) => (Math.abs(xOf(t) - S.x.to) < Math.abs(xOf(a) - S.x.to) ? t : a));
    if (e.pointerType === 'mouse' && near !== tipFor) showTip(near);
    go();
  });
  const up = (e) => {
    if (!down || e.pointerId !== down.id) return;
    S.sx.to = S.sy.to = 1; S.bend.to = BEND;
    if (dragging) {
      const near = tabs.reduce((a, t) => (Math.abs(xOf(t) - S.x.to) < Math.abs(xOf(a) - S.x.to) ? t : a));
      dragging = false;
      nav.classList.remove('dragging');
      S.sy.vel += 1.6;                                     // set down with a little jiggle
      select(near.dataset.view);
      if (e.pointerType !== 'mouse') showTip(near, { brief: true });
    } else if (e.pointerType !== 'mouse') {
      const t = e.target.closest('.tab');
      if (t) showTip(t, { brief: true });
    }
    down = null;
    go();
  };
  nav.addEventListener('pointerup', up);
  nav.addEventListener('pointercancel', up);

  nav.addEventListener('keydown', (e) => {
    const i = names.indexOf(current);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: names.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(names[(next + names.length) % names.length], { focus: true });
    showTip(tabs[names.indexOf(current)]);
  });

  new ResizeObserver(() => { refract(); S.x.to = S.x.v = xOf(tabs[names.indexOf(current)]); apply(); }).observe(nav);
  select(location.hash.slice(1) || names[0], { animate: false });
  if (current !== names[0]) {
    // opened straight onto another view: show it without a transition
    for (const n of names) document.getElementById(`view-${n}`).hidden = n !== current;
  }
  addEventListener('hashchange', () => select(location.hash.slice(1) || names[0]));
}
