// A piece of writing's page (writing/<name>.html): the contents rail down the left (built from the piece's h2s and
// h3s) whose line follows you as you read and glides to a section when you click it, and the same contents folded
// up for narrow screens.

/* ---------------- the contents: the rail, and the folded-up list ---------------- */

const heads = [...document.querySelectorAll('.post-body h2, .post-body h3')];
const rail = document.querySelector('.rail');
const track = rail?.querySelector('.rail-track');
const list = rail?.querySelector('.rail-list');
const inline = document.querySelector('.toc-inline ol');
const items = [];

for (const [i, h] of heads.entries()) {
  if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sub = h.tagName === 'H3';
  if (list) {
    const li = document.createElement('li');
    if (sub) li.className = 'sub';
    li.style.setProperty('--i', i);
    li.innerHTML = `<a href="#${h.id}"><span class="mark" aria-hidden="true"></span><span class="label"></span></a>`;
    li.querySelector('.label').textContent = h.textContent;
    list.append(li);
    items.push(li);
  }
  if (inline) {
    const li = document.createElement('li');
    if (sub) li.className = 'sub';
    li.innerHTML = `<a href="#${h.id}"></a>`;
    li.firstChild.textContent = h.textContent;
    inline.append(li);
  }
}
if (!heads.length) { rail?.remove(); document.querySelector('.toc-inline')?.remove(); }

let centres = [];
let active = -2;

// where each marker sits down the rail, so the line runs from the first to the last
function layout() {
  if (!track || !rail || getComputedStyle(rail).display === 'none') return;
  centres = items.map(li => { const m = li.querySelector('.mark'); return m.offsetTop + m.offsetHeight / 2 + li.offsetTop; });
  if (!centres.length) return;
  track.style.setProperty('--top', `${centres[0] + list.offsetTop}px`);
  track.style.setProperty('--len', `${centres.at(-1) - centres[0]}px`);
}

function setActive(i) {
  if (i === active) return;
  active = i;
  items.forEach((li, j) => { li.classList.toggle('active', j === i); li.classList.toggle('passed', j < i); });
  // keep the section you're in within view when the rail has more sections than room
  const li = items[i];
  if (li && track) {
    const top = li.offsetTop, bot = top + li.offsetHeight;
    if (top < track.scrollTop + 20 || bot > track.scrollTop + track.clientHeight - 20)
      track.scrollTo({ top: top - track.clientHeight / 2, behavior: 'smooth' });
  }
}

// Which section you're in: the last heading that has come up to just under the top of the screen (where a click
// lands it). The line doesn't stop at markers: between two headings it fills in step with how far you've read
// through that section, so it creeps down as you scroll rather than jumping from marker to marker.
const LINE = 80;   // px from the top: a little under where a clicked heading comes to rest (its 28px scroll margin)
let held = -1;     // a section you clicked stays the one you're in until you scroll yourself
function reading() {
  if (held >= 0) return { i: held, at: centres[held] ?? 0 };
  let i = -1;
  for (const [j, h] of heads.entries()) if (h.getBoundingClientRect().top <= LINE) i = j;
  if (i < 0 || !centres.length) return { i, at: centres[0] ?? 0 };
  const top = heads[i].getBoundingClientRect().top;
  const next = heads[i + 1]?.getBoundingClientRect().top
    ?? document.documentElement.scrollHeight - scrollY;   // the last section runs to the end of the page
  const k = Math.min(1, Math.max(0, (LINE - top) / Math.max(1, next - top)));
  const to = centres[i + 1] ?? centres[i];
  return { i, at: centres[i] + (to - centres[i]) * k };
}

// the fill eases towards where you are, every frame, so it glides after you instead of snapping
let shown = 0, last = 0, running = false;
function frame(now) {
  const dt = Math.min(64, now - (last || now)); last = now;
  const { i, at } = reading();
  setActive(i);
  const target = Math.max(0, at - (centres[0] ?? 0));
  const ease = 1 - Math.exp(-dt / (held >= 0 ? 170 : 130));
  shown += (target - shown) * ease;
  if (Math.abs(target - shown) < .2) shown = target;
  track?.style.setProperty('--fill', `${shown.toFixed(2)}px`);
  if (shown !== target) requestAnimationFrame(frame); else { running = false; last = 0; }
}
const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
addEventListener('scroll', kick, { passive: true });

// clicking a section: the line glides there and that section stays the one you're in (even a short one near the end,
// which can't scroll all the way to the top) until you scroll yourself
function go(e) {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const i = heads.findIndex(h => `#${h.id}` === a.getAttribute('href'));
  if (i < 0) return;
  e.preventDefault();
  held = i;
  kick();
  heads[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${heads[i].id}`);
}
list?.addEventListener('click', go);
inline?.addEventListener('click', go);
const letGo = () => { if (held >= 0) { held = -1; kick(); } };
for (const ev of ['wheel', 'touchmove']) addEventListener(ev, letGo, { passive: true });
addEventListener('keydown', (e) => { if (/^(Arrow|Page|Home|End| )/.test(e.key) || e.key === ' ') letGo(); });
addEventListener('pointerdown', (e) => { if (e.target === document.documentElement) letGo(); });   // the scrollbar

const relayout = () => { layout(); kick(); };
addEventListener('resize', relayout);
document.fonts?.ready.then(relayout);
relayout();

// the made-up pieces in the list don't go anywhere yet
for (const a of document.querySelectorAll('a[data-dead]')) a.addEventListener('click', e => e.preventDefault());
