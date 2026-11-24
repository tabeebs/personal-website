// "shaf" is the way to get my email: clicking the name (or Enter / Space) copies the address, and a little mustard
// label pops up above it to say "email copied!". The small bit of effort keeps the emails that do arrive mostly
// from real people. The address is put together here rather than written in the page, so scrapers reading the
// HTML don't find it. If the clipboard isn't available, the label shows the address instead.
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
  const tip = document.createElement('span');
  tip.className = 'copied';
  tip.setAttribute('aria-hidden', 'true');
  el.append(tip);
  const live = document.createElement('span');   // what screen readers hear
  live.className = 'sr'; live.setAttribute('aria-live', 'polite');
  el.after(live);

  let timer = 0;
  const say = (text, wait) => {
    tip.textContent = text;
    tip.classList.remove('show');
    void tip.offsetWidth;   // restart the pop if it's already showing
    tip.classList.add('show');
    live.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => { tip.classList.remove('show'); live.textContent = ''; }, wait);
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
