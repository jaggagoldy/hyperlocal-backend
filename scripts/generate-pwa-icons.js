/**
 * Generates the PWA app icons used by manifest.json.
 *
 * Produces same-origin PNGs (not external placeholders) so the manifest is
 * actually installable. The icons are full-bleed (maskable-safe): a brand
 * gradient background fills the whole canvas with a white location pin mark
 * kept inside the 80% safe zone.
 *
 * Run with:  node scripts/generate-pwa-icons.js
 * No third-party dependencies — uses only Node's built-in zlib.
 */
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'src', 'public', 'icons');

// ─── Tiny PNG encoder (RGBA, 8-bit) ──────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0

  // Add the mandatory per-scanline filter byte (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ─── Draw the brand icon ─────────────────────────────────────────────────────
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

const drawIcon = (size) => {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  // Pin geometry, kept within the maskable safe zone.
  const pinHeadCx = cx;
  const pinHeadCy = size * 0.42;
  const pinHeadR = size * 0.16;
  const dotR = size * 0.06;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Diagonal brand gradient (#6366f1 -> #8b5cf6).
      const t = (x + y) / (2 * size);
      let r = lerp(0x63, 0x8b, t);
      let g = lerp(0x66, 0x5c, t);
      let b = lerp(0xf1, 0xf6, t);

      // White location-pin mark.
      const dHead = Math.hypot(x - pinHeadCx, y - pinHeadCy);
      const inHead = dHead <= pinHeadR;
      // Triangular tail under the head.
      const tailTop = pinHeadCy;
      const tailBottom = size * 0.72;
      const tailHalfAtTop = pinHeadR * 0.82;
      let inTail = false;
      if (y >= tailTop && y <= tailBottom) {
        const prog = (y - tailTop) / (tailBottom - tailTop);
        const halfWidth = tailHalfAtTop * (1 - prog);
        inTail = Math.abs(x - pinHeadCx) <= halfWidth;
      }
      const inHole = Math.hypot(x - pinHeadCx, y - pinHeadCy) <= dotR;

      if ((inHead || inTail) && !inHole) {
        r = 0xff;
        g = 0xff;
        b = 0xff;
      }

      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 0xff;
    }
  }
  return encodePng(size, size, rgba);
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`✅ wrote ${path.relative(path.join(__dirname, '..'), file)}`);
}
