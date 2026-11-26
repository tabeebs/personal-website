// Capture a site for the peek window, in a normal (headed) Chrome on a throwaway profile, driven over CDP.
// usage: node scripts/capture-preview.mjs <url> <outdir> still|video|smooth|inspect
// (smooth: the frame-by-frame recording used for assets/previews/salesforce.mp4; encode its frames with ffmpeg at 60fps,
// scaled to 544x340)
// still: one full-page PNG at 1280 wide.  video: viewport screencast frames (1280x800) while the page scrolls
// like someone reading, then eases back to the top; frames + timestamps land in <outdir>/frames.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [url, out, mode] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333, W = 1280, H = 800;
const profile = join(out, 'profile');
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', `--window-size=${W + 16},${H + 140}`, '--window-position=40,40', 'about:blank'], { stdio: 'ignore' });

let targets;
for (let i = 0; i < 40; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(), listeners = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  else listeners.forEach((f) => f(m));
});
const send = (method, params = {}, ms = 15000) => new Promise((r) => { const i = ++id; waiting.set(i, r);
  setTimeout(() => { if (waiting.has(i)) { waiting.delete(i); r({ timeout: true }); } }, ms);
  ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(9000);

// hide cookie notices (and the dimmed backdrop they put over the page) without answering them
const HIDE = `(() => {
  const kill = (el) => el && el.remove();
  document.querySelectorAll('[id*="onetrust" i],[class*="onetrust" i],[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="sliding-popup" i]').forEach((el) => {
    const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'sticky' || el.closest('[style*="fixed"]') || /cookie|consent|onetrust/i.test(el.id)) kill(el);
  });
  // any remaining fixed full-screen veil
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.position === 'fixed' && r.width >= innerWidth * .9 && r.height >= innerHeight * .9 && !el.querySelector('img,video,canvas')) kill(el);
  }
  // undo any scroll lock the notice set, without making the body a scroller of its own
  for (const n of [document.documentElement, document.body]) {
    n.style.removeProperty('overflow'); n.classList.remove('onetrust-no-scroll');
    if (getComputedStyle(n).overflowY === 'hidden') n.style.setProperty('overflow', 'visible', 'important');
  }
  return document.documentElement.scrollHeight;
})()`;
let height = await evaluate(HIDE);
console.log('page height', height, 'title', await evaluate('document.title'));

if (mode === 'inspect') {
  for (let k = 0; k < 3; k++) {
    await evaluate(`scrollTo(0, ${1200 * (k + 1)})`); await sleep(6000);
    console.log(JSON.stringify(await evaluate(`(() => { const out = [];
      const walk = (root, path) => { for (const el of root.querySelectorAll('*')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if ((cs.position === 'fixed' || el.tagName === 'IFRAME') && r.width > 0) out.push([path, el.tagName, el.id, String(el.className).slice(0, 50), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]);
        if (el.shadowRoot) walk(el.shadowRoot, path + '>' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')); } };
      walk(document, ''); return out; })()`)));
  }
} else if (mode === 'smooth') {
  // frame by frame: scroll to each frame's exact position and screenshot it, so the scrolling is perfectly even however
  // the page stutters. Capturing is slower than real time, so the page's own animations (CSS / web animations, videos)
  // are slowed by the same factor, and play at their own speed in the result.
  const FPS = 60;
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}'; document.head.append(s); })()`);
  // keep the chat widget (Qualified's "Piper", in its own shadow root) out of the shot
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = '[id^="qualified"], .qualified-frame { display: none !important; }'; document.head.append(s); })()`);
  for (let y = 0; y < Math.min(height, 4400); y += 700) { await evaluate(`scrollTo(0, ${y})`); await sleep(300); }
  await evaluate('scrollTo(0, 0)'); await sleep(2500); await evaluate(HIDE);
  const max = Math.min(await evaluate('document.documentElement.scrollHeight - innerHeight'), 3600);
  // the plan, in frames: a look at the top, a screenful or so at a time with reading pauses, then back up
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const ys = []; const hold = (s, y) => { for (let i = 0; i < s * FPS; i++) ys.push(y); };
  const move = (a, b, s) => { const n = Math.round(s * FPS); for (let i = 1; i <= n; i++) ys.push(a + (b - a) * ease(i / n)); };
  let y = 0; hold(1.8, 0);
  while (y < max) { const to = Math.min(max, y + 520 + Math.random() * 300); move(y, to, 1.1 + (to - y) / 1000 * .9); y = to; hold(1.1 + Math.random() * .7, y); }
  move(y, 0, 1.8); hold(1.2, 0);
  // the hero's demo carousel changes slides on a JS timer, which can't be slowed with the rest, so hold it on its
  // first slide with its own pause button (the topmost pause button on the page)
  console.log('paused carousel:', await evaluate(`(() => { const found = [];
    const walk = (root) => { for (const el of root.querySelectorAll('button,[role="button"]')) {
      const label = (el.getAttribute('aria-label') || el.title || el.textContent || '').trim();
      if (/pause/i.test(label)) { const r = el.getBoundingClientRect(); if (r.width) found.push([r.top + scrollY, el, label]); } }
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot); };
    walk(document); found.sort((a, b) => a[0] - b[0]);
    if (!found.length) return 'none';
    found[0][1].click(); return found[0][2] + ' at ' + Math.round(found[0][0]); })()`));
  await sleep(1500);
  const dir = join(out, 'frames'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  await send('Animation.enable');
  const rate = async (r) => { await send('Animation.setPlaybackRate', { playbackRate: r });
    await evaluate(`document.querySelectorAll('video').forEach((v) => { try { v.playbackRate = ${r}; } catch {} })`); };
  let r = .25; await rate(r);
  const t0 = Date.now();
  for (let i = 0; i < ys.length; i++) {
    await evaluate(`scrollTo(0, ${ys[i].toFixed(1)})`);
    let shot;
    for (let k = 0; k < 4 && !(shot && shot.result); k++) {
      shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true }, 5000);
      if (!shot.result) {   // nothing new to paint, or the window went quiet: wake it and force a fresh frame
        console.log('retry frame', i); await send('Page.bringToFront');
        await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
        await evaluate(`document.documentElement.style.outline = document.documentElement.style.outline ? '' : '0 solid transparent'`);
        await sleep(200);
      }
    }
    writeFileSync(join(dir, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
    if (i === 40) {   // calibrate: how long a frame really takes, so the page's animations keep their own speed
      const per = (Date.now() - t0) / 41 / 1000; r = Math.min(1, (1 / FPS) / per); await rate(r);
      console.log('ms per frame', (per * 1000).toFixed(0), 'animation rate', r.toFixed(3));
    }
  }
  console.log('frames', ys.length, 'seconds', (ys.length / FPS).toFixed(1), 'took', ((Date.now() - t0) / 1000).toFixed(0) + 's');
} else if (mode === 'still') {
  // walk down once so lazy images load, then back to the top
  for (let y = 0; y < height; y += 600) { await evaluate(`scrollTo(0, ${y})`); await sleep(250); }
  await evaluate('scrollTo(0, 0)'); await sleep(1500); await evaluate(HIDE);
  const full = Math.min(4000, await evaluate('document.documentElement.scrollHeight'));
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: full, deviceScaleFactor: 1, mobile: false });
  await sleep(2500); await evaluate(HIDE);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'full.png'), Buffer.from(shot.result.data, 'base64'));
} else {
  // warm up lazy content, then record
  for (let y = 0; y < Math.min(height, 4200); y += 700) { await evaluate(`scrollTo(0, ${y})`); await sleep(300); }
  await evaluate('scrollTo(0, 0)'); await sleep(2500); await evaluate(HIDE);
  const dir = join(out, 'frames'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  const frames = [];
  listeners.push((m) => {
    if (m.method !== 'Page.screencastFrame') return;
    const n = frames.length, f = join(dir, `f${String(n).padStart(5, '0')}.jpg`);
    writeFileSync(f, Buffer.from(m.params.data, 'base64'));
    frames.push({ file: f, t: m.params.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  });
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  // scroll like someone reading: a look at the top, then a screenful or so at a time with pauses, then back up
  await evaluate(`new Promise((done) => {
    const max = Math.min(document.documentElement.scrollHeight - innerHeight, 3600);
    const ease = (t) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const steps = []; let y = 0, hold = 1800;
    while (y < max) { const to = Math.min(max, y + 520 + Math.random() * 300); steps.push([y, to, 1100 + (to - y) * .9, hold]); y = to; hold = 1100 + Math.random() * 700; }
    steps.push([y, 0, 1800, 1200]);
    let i = 0;
    const run = () => {
      if (i >= steps.length) return setTimeout(done, 1400);
      const [a, b, dur, wait] = steps[i++];
      setTimeout(() => { const t0 = performance.now();
        const f = (now) => { const k = Math.min(1, (now - t0) / dur); scrollTo(0, a + (b - a) * ease(k)); k < 1 ? requestAnimationFrame(f) : run(); };
        requestAnimationFrame(f); }, wait);
    };
    run();
  })`);
  await send('Page.stopScreencast');
  await sleep(300);
  // ffmpeg concat list: each frame held until the next one arrived
  let list = '';
  frames.forEach((f, i) => { const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 1 / 30;
    list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; });
  list += `file '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
  writeFileSync(join(out, 'frames.txt'), list);
  console.log('frames', frames.length, 'seconds', (frames.at(-1).t - frames[0].t).toFixed(1));
}
ws.close(); chrome.kill(); await sleep(800);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
