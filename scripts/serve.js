// The local preview server (npm start): serves the site's files, and the page itself for any other path, the way
// Cloudflare Pages does when the site is live, so /experience opens the Experience view here too.
// Usage: node scripts/serve.js [port]   (5173 by default)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const PORT = +(process.argv[2] || process.env.PORT || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function file(path) {
  try { return (await stat(path)).isFile() ? path : null; } catch { return null; }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const path = join(ROOT, rel);
  if ((path !== ROOT && !path.startsWith(ROOT + sep)) || rel.split(sep).includes('node_modules')) { res.writeHead(404).end(); return; }
  // a real file is served as it is; a path with no file extension is a view of the page; anything else is missing
  const found = await file(path) ?? await file(join(path, 'index.html')) ?? (extname(rel) ? null : join(ROOT, 'index.html'));
  if (!found) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(await readFile(found));
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
