// The Experience view: two sentences whose endings keep changing, after Mobbin's headline (mobbin.com).
//   i'm currently a  Data Science Intern @ [logo] Salesforce.
//   before that, i was a  Tech Director @ [logo] UNSW DataSoc.
// Each line moves on by itself every few seconds (the two take turns), or when its logo or words are clicked. The
// role, the logo and the name change in a quick left-to-right wave: words blur up and away while the new ones
// blur in from below and the line eases to its new length; the old logo blurs and shrinks away and the new one
// comes in from a blur, overshooting a hair before it settles. Each logo sits in a slot with no height, just
// before its name and a touch below the line, so it never changes the line's height. Whenever the view is shown
// the lines arrive without their logos; then each slot opens, nudging the name along, and its logo pops in.
// The page also lists every role as plain text for screen readers; the moving sentences are hidden from them.
// Source for build/experience.js: rebuild with `npm run build` after editing.

// each logo is a 128px square in assets/logos, cropped and sized to sit at the same weight as the others
const NOW = [
  { role: 'Data Science Intern', org: 'Salesforce', logo: 'salesforce' },
  { role: 'Research Assistant', org: 'Kirby Institute', logo: 'kirby' },
  { role: 'Teaching Assistant', org: 'UNSW CSE', logo: 'unsw' },
];
const BEFORE = [
  { role: 'Tech Director', org: 'UNSW DataSoc', logo: 'datasoc' },
  { role: 'Partnerships Director', org: 'UNSW AISoc', logo: 'aisoc' },
  { role: 'Private Tutor', org: "Shaf's Tutoring", logo: 'tutor' },
];

const host = document.querySelector('[data-experience]');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const HOLD = 3400;                                   // how long each line rests before moving on, ms
const EASE = 'cubic-bezier(.16, 1, .3, 1)';

// a logo tile: the square image edge to edge, with a glint that can sweep across it; if the image can't load, the
// org's initial
function tile(it) {
  const t = document.createElement('span');
  t.className = 'tile';
  const img = new Image();
  img.alt = ''; img.draggable = false; img.decoding = 'async';
  img.onerror = () => { img.remove(); t.classList.add('mono'); t.prepend(it.org.replace(/^UNSW /, '')[0]); };
  img.src = `assets/logos/${it.logo}.png`;
  const glint = document.createElement('span'); glint.className = 'glint';
  t.append(img, glint);
  return t;
}
const shine = (layer, delay) => layer.querySelector('.glint')?.animate(
  [{ transform: 'translateX(-130%) skewX(-18deg)', opacity: 0 }, { opacity: 1, offset: .25 }, { transform: 'translateX(130%) skewX(-18deg)', opacity: 0 }],
  { duration: 760, delay, easing: 'cubic-bezier(.3, .2, .2, 1)', fill: 'backwards' });

const out = (el, delay, to) => el.animate([{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: 'blur(7px)', transform: to }],
  { duration: 280, delay, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });

// a word whose text can change; its width eases from the old word to the new one
function word(text) {
  const w = document.createElement('span');
  w.className = 'word';
  const s = document.createElement('span'); s.textContent = text; w.append(s);
  w.set = (next, delay) => {
    while (w.children.length > 1) w.firstElementChild.remove();   // a change still leaving is cleared at once
    w.lastElementChild.getAnimations().forEach((a) => a.finish());
    const old = w.lastElementChild, from = w.offsetWidth;
    const n = document.createElement('span'); n.textContent = next;
    old.classList.add('going');
    w.append(n);
    if (calm.matches) { old.remove(); return; }
    const to = n.offsetWidth;
    w.style.width = `${from}px`; void w.offsetWidth; w.style.width = `${to}px`;
    out(old, delay, 'translateY(-.14em)').finished.then(() => old.remove(), () => {});
    n.animate([{ opacity: 0, filter: 'blur(7px)', transform: 'translateY(.14em)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }],
      { duration: 460, delay: delay + 70, easing: EASE, fill: 'backwards' })
      .finished.then(() => { if (w.lastElementChild === n) w.style.width = ''; }, () => {});
  };
  w.text = () => w.lastElementChild.textContent;
  w.put = (t) => { w.lastElementChild.textContent = t; };       // swap the text with no animation (for measuring)
  return w;
}

// the logo slot: a button holding stacked logo layers that crossfade through a blur
function slot(it) {
  const s = document.createElement('span');
  s.className = 'slot';
  s.innerHTML = '<span class="slot-inner"><button class="logo-button" type="button" tabindex="-1" aria-hidden="true"></button></span>';
  const btn = s.querySelector('button');
  const layer = (x) => { const l = document.createElement('span'); l.className = 'layer'; l.append(tile(x)); return l; };
  btn.append(layer(it));
  s.button = btn;
  s.set = (next, delay, glint = false) => {
    while (btn.children.length > 1) btn.firstElementChild.remove();
    btn.lastElementChild.getAnimations().forEach((a) => a.finish());
    const old = btn.lastElementChild, n = layer(next);
    btn.append(n);
    if (calm.matches) { old.remove(); return; }
    out(old, delay, 'scale(.78)').finished.then(() => old.remove(), () => {});
    n.animate([
      { opacity: 0, filter: 'blur(7px)', transform: 'scale(.72)' },
      { opacity: 1, filter: 'blur(0)', transform: 'scale(1.03)', offset: .45 },
      { transform: 'scale(.995)', offset: .68 },
      { transform: 'scale(1.001)', offset: .85 },
      { opacity: 1, filter: 'blur(0)', transform: 'none' },
    ], { duration: 480, delay: delay + 60, easing: 'ease-out', fill: 'backwards' });
    if (glint) shine(n, delay + 300);
  };
  s.shine = (delay) => shine(btn.lastElementChild, delay);
  return s;
}

function sentence(lead, items, offset) {
  const p = document.createElement('p');
  p.className = 'says piece';
  p.setAttribute('aria-hidden', 'true');
  const role = word(items[0].role), org = word(items[0].org), logo = slot(items[0]);
  const leadEl = document.createElement('span'); leadEl.className = 'lead'; leadEl.textContent = lead;
  const tail = document.createElement('span'); tail.className = 'tail';   // a logo always stays with its name
  tail.append(logo, org, '.');
  p.append(leadEl, ' ', role, ' @', tail);
  host.append(p);

  // hold room for the longest ending, so the panel never jumps when a line moves on to one that wraps
  const fit = () => {
    if (!p.offsetParent) return;
    p.style.minHeight = '';
    const keep = [role.text(), org.text()];
    let tallest = 0;
    for (const it of items) { role.put(it.role); org.put(it.org); tallest = Math.max(tallest, p.offsetHeight); }
    role.put(keep[0]); org.put(keep[1]);
    p.style.minHeight = `${tallest}px`;
  };

  let i = 0, timer = 0, shown = false;
  const next = (clicked) => {
    i = (i + 1) % items.length;
    const it = items[i];
    role.set(it.role, 0);            // a quick wave across the line: the role, then the logo, then the name
    logo.set(it, 60, clicked === true);   // a clicked logo glints as it lands
    org.set(it.org, 110);
    queue(HOLD);
  };
  const queue = (wait) => { clearTimeout(timer); if (shown && !document.hidden) timer = setTimeout(next, wait); };
  for (const el of [logo.button, role, org]) el.addEventListener('click', () => next(true));

  return {
    fit,
    // the view came into sight. As on Mobbin, the line arrives with no logo: the name sits right up against the
    // "@". Then the slot opens, nudging the name along to make room, and the logo pops in from a blur, overshoots
    // a touch, settles, and a glint runs across it.
    show(delay) {
      shown = true;
      fit();
      if (!calm.matches) {
        logo.animate([{ width: '.194em' }, { width: 'calc(var(--icon-size) + 2 * var(--icon-gap))' }],
          { duration: 420, delay, easing: 'cubic-bezier(.34, 1.36, .5, 1)', fill: 'backwards' });
        logo.firstElementChild.animate([
          { opacity: 0, transform: 'translateX(-50%) scale(.6) rotate(-10deg)', filter: 'blur(7px)' },
          { opacity: 1, transform: 'translateX(-50%) scale(1.06) rotate(2deg)', filter: 'blur(0)', offset: .45 },
          { transform: 'translateX(-50%) scale(.985) rotate(-.6deg)', offset: .68 },
          { transform: 'translateX(-50%) scale(1.004) rotate(0deg)', offset: .85 },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', filter: 'blur(0)' },
        ], { duration: 620, delay: delay + 110, easing: 'ease-out', fill: 'backwards' });
        logo.shine(delay + 520);
      }
      queue(HOLD + offset);
    },
    hide() { shown = false; clearTimeout(timer); },
    pause() { clearTimeout(timer); },          // the page went out of sight
    resume() { queue(HOLD); },                 // and came back; starts again only if the view is showing
  };
}

if (host) {
  // fetch every logo up front, so none is still loading when its turn comes and it pops in
  for (const it of [...NOW, ...BEFORE]) new Image().src = `assets/logos/${it.logo}.png`;
  const view = host.closest('.view');
  const lines = [sentence("i'm currently a", NOW, 0), sentence('before that, i was a', BEFORE, HOLD / 2)];
  // the logos come out once the lines have landed: after tabs.js has slid them in, or soon after the page opens
  const sync = (settle) => {
    if (view.hidden) lines.forEach((l) => l.hide());
    else lines.forEach((l, n) => l.show(settle + n * 200));
  };
  new MutationObserver(() => sync(640)).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  sync(380);
  new ResizeObserver(() => lines.forEach((l) => l.fit())).observe(host);
  document.addEventListener('visibilitychange', () => lines.forEach((l) => (document.hidden ? l.pause() : l.resume())));
}
