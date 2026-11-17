// Writes favicon.png, the still tab icon linked from index.html, from the same drawing the page animates.
// Run with `npm run favicon` after changing src/favicon-art.js.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { SIZE, STILL, frame } from '../src/favicon-art.js';

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const px = frame(STILL), rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  rows[y * (SIZE * 4 + 1)] = 0;                                  // no filter
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(rows, y * (SIZE * 4 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6;   // 8-bit RGBA
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(new URL('../favicon.png', import.meta.url), png);
console.log(`favicon.png: ${SIZE}x${SIZE}, ${png.length} bytes`);
