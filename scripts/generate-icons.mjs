// Génère les icônes provisoires de la PWA dans public/icons, sans dépendance.
// Dessin : fond vert sombre, pelouse verte arrondie, rond central blanc.
// Les vraies icônes arriveront au jalon M7.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);

const BG = [11, 20, 16];
const PITCH = [21, 128, 61];
const LINE = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // profondeur
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** contentScale : part de l'icône occupée par le dessin (plus petit pour l'icône « maskable »). */
function draw(size, contentScale) {
  const c = size / 2;
  const half = (size * contentScale) / 2;
  const radius = half * 0.28;
  const stroke = Math.max(2, size * 0.022 * contentScale);
  const circle = half * 0.38;

  return encodePng(size, (x, y) => {
    const dx = Math.abs(x - c);
    const dy = Math.abs(y - c);
    // Rectangle arrondi de la pelouse
    const qx = Math.max(dx - (half - radius), 0);
    const qy = Math.max(dy - (half - radius), 0);
    if (Math.hypot(qx, qy) > radius) return BG;
    // Ligne médiane et rond central
    const dist = Math.hypot(x - c, y - c);
    if (Math.abs(y - c) < stroke / 2 || Math.abs(dist - circle) < stroke / 2 || dist < stroke * 1.4) {
      return LINE;
    }
    return PITCH;
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = [
  ['apple-touch-icon.png', 180, 0.84],
  ['icon-192.png', 192, 0.84],
  ['icon-512.png', 512, 0.84],
  ['icon-maskable-512.png', 512, 0.66],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, OUT_DIR), draw(size, scale));
  console.log(`public/icons/${name}`);
}
