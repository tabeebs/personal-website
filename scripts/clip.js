// Cut a short clip out of an episode for the AoT clip view (src/arcs.js), using ffmpeg.
//
//   npm run clip -- "<episode file>" <start> <end> <name> [--gif] [--width 960]
//   npm run clip -- "D:\aot\S01E09.mkv" 14:40 14:52 levi-disgusting
//
// Times are m:ss or h:mm:ss (decimals are fine: 14:40.5). Writes assets/aot/clips/<name>.mp4: no sound, 24fps,
// small. On the page it plays exactly like a GIF (muted, looping, autoplay) at a tenth of the size. --gif makes a
// real .gif instead, if you ever need one. Then it prints the line to paste into the connection's "clips".
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, name === '--gif' ? 1 : 2).slice(1)[0] ?? true; };
const gif = flag('--gif') != null;
const width = +(flag('--width') || (gif ? 640 : 960));
const [input, start, end, name] = args;
if (!input || !start || !end || !name) {
  console.log('usage: npm run clip -- "<episode file>" <start> <end> <name> [--gif] [--width 960]');
  process.exit(1);
}
const secs = (t) => String(t).split(':').reduce((s, p) => s * 60 + Number(p), 0);
const dur = secs(end) - secs(start);
if (!(dur > 0)) { console.error(`end (${end}) has to come after start (${start})`); process.exit(1); }
if (dur > 20) console.warn(`that's ${dur.toFixed(1)}s, long for a looping clip; a few seconds usually says it better`);

const dir = fileURLToPath(new URL('../assets/aot/clips/', import.meta.url));
mkdirSync(dir, { recursive: true });
const out = `${dir}${name}.${gif ? 'gif' : 'mp4'}`;

const vf = gif
  ? `fps=15,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`
  : `fps=24,scale=${width}:-2:flags=lanczos`;
const codec = gif ? [] : ['-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(secs(start)), '-i', input, '-t', String(dur),
  '-vf', vf, '-an', ...codec, out], { stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

const kb = Math.round(statSync(out).size / 1024);
console.log(`\nwrote assets/aot/clips/${name}.${gif ? 'gif' : 'mp4'} (${dur.toFixed(1)}s, ${kb} KB)`);
console.log('add it to the connection in assets/aot/connections.json ("at" is "from" or "to", whichever end it shows):');
console.log(`  { "src": "/assets/aot/clips/${name}.${gif ? 'gif' : 'mp4'}", "at": "from", "caption": "" }`);
