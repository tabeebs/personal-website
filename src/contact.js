// The Email row doesn't open a mail app: clicking it copies the address, and a little tomato label (the email
// doodle's colour) pops up under "Email" to say so. The small bit of effort keeps the emails that do arrive
// mostly from real people. The address is put together here rather than written in the page, so scrapers
// reading the HTML don't find it. If the clipboard isn't available, the label shows the address instead.
// Source for build/contact.js: rebuild with `npm run build` after editing.

const ADDRESS = ['hi', 'tabeebs.com'].join('@');

for (const btn of document.querySelectorAll('[data-copy-email]')) {
  const host = btn.querySelector('.label');
  const tip = document.createElement('span');
  tip.className = 'copied';
  tip.setAttribute('aria-hidden', 'true');
  host.append(tip);
  const live = document.createElement('span');   // what screen readers hear
  live.className = 'sr'; live.setAttribute('aria-live', 'polite');
  btn.after(live);

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

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ADDRESS);
      say('copied to clipboard!', 1800);
    } catch {
      say(ADDRESS, 6000);
    }
  });
}
