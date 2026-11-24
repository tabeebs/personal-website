// "shaf" is the way to get my email. Hovering the name puts a selection box round it, like picking a layer in a
// design tool: a thin blue frame with a handle at each corner and a little tag above giving its size. Clicking it
// (or Enter / Space) copies the address, and the tag says "email copied!". The small bit of effort keeps the
// emails that do arrive mostly from real people. The address is put together here rather than written in the
// page, so scrapers reading the HTML don't find it. If the clipboard isn't available, the tag shows the address.
// Source for build/contact.js: rebuild with `npm run build` after editing.

const ADDRESS = ['hi', 'tabeebs.com'].join('@');

// where the async clipboard is blocked (some embedded browsers, non-https pages), the old select-and-copy still
// works from a click
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

for (const el of document.querySelectorAll('[data-copy-email]')) {
  const box = document.createElement('span');
  box.className = 'name-box';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) box.append(document.createElement('i'));
  const tag = document.createElement('span');
  tag.className = 'name-tag';
  box.append(tag);
  el.append(box);
  tag.textContent = `${Math.round(box.offsetWidth)} × ${Math.round(box.offsetHeight)}`;
  const live = document.createElement('span');   // what screen readers hear
  live.className = 'sr'; live.setAttribute('aria-live', 'polite');
  el.after(live);

  // at rest the tag reads the box's size, as a design tool would
  const measure = () => `${Math.round(box.offsetWidth)} × ${Math.round(box.offsetHeight)}`;
  let timer = 0;
  const rest = () => { el.classList.remove('picked'); tag.textContent = measure(); live.textContent = ''; };
  el.addEventListener('pointerenter', () => { if (!el.classList.contains('picked')) tag.textContent = measure(); });

  const say = (text, wait) => {
    tag.textContent = text;
    el.classList.remove('picked');
    void tag.offsetWidth;   // restart the pop if it's already showing
    el.classList.add('picked');
    live.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(rest, wait);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ADDRESS);
      say('email copied!', 1800);
    } catch {
      const ok = legacyCopy(ADDRESS);
      say(ok ? 'email copied!' : ADDRESS, ok ? 1800 : 6000);
    }
  };
  el.addEventListener('click', copy);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); }
  });
}
