// Génère les icônes de la PWA dans public/icons, sans dépendance :
// un stade vu de haut devant la silhouette d'une ville, sur fond vert sombre.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);

const BG = [11, 20, 16];
const SKYLINE = [31, 111, 67];
const WINDOWS = [74, 222, 128];
const STAND = [232, 238, 233];
const PITCH = [34, 197, 94];
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
      raw.set(pixel(x, y), row + 1 + x * 3);
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

// Immeubles : [gauche, droite, hauteur], en fraction du dessin ; leur pied est caché derrière le stade.
const BUILDINGS = [
  [0.06, 0.17, 0.3],
  [0.19, 0.29, 0.46],
  [0.31, 0.39, 0.24],
  [0.61, 0.69, 0.4],
  [0.71, 0.8, 0.28],
  [0.82, 0.94, 0.36],
];
const SKYLINE_BASE = 0.62;

/** Couleur d'un point (u, v) du dessin, entre 0 et 1. */
function scene(u, v) {
  // Stade : une ellipse de tribunes, la pelouse au centre, ligne médiane et rond central.
  const cx = 0.5;
  const cy = 0.64;
  const dx = (u - cx) / 0.44;
  const dy = (v - cy) / 0.24;
  const r = Math.hypot(dx, dy);
  if (r <= 1) {
    if (r > 0.74) return STAND;
    const px = (u - cx) / (0.44 * 0.74);
    const py = (v - cy) / (0.24 * 0.74);
    if (Math.abs(u - cx) < 0.012) return LINE;
    const centre = Math.hypot(px * 0.44, py * 0.24);
    if (Math.abs(centre - 0.06) < 0.01) return LINE;
    return PITCH;
  }
  // Ville derrière le stade.
  for (const [left, right, height] of BUILDINGS) {
    if (u >= left && u <= right && v <= SKYLINE_BASE && v >= SKYLINE_BASE - height) {
      // Quelques fenêtres allumées.
      const col = Math.floor(((u - left) / (right - left)) * 3);
      const row = Math.floor((SKYLINE_BASE - v) / 0.06);
      const inCellX = (((u - left) / (right - left)) * 3) % 1;
      const inCellY = ((SKYLINE_BASE - v) / 0.06) % 1;
      if ((col + row) % 2 === 0 && inCellX > 0.3 && inCellX < 0.7 && inCellY > 0.35 && inCellY < 0.7) return WINDOWS;
      return SKYLINE;
    }
  }
  return BG;
}

/** contentScale : part de l'icône occupée par le dessin (plus petite pour l'icône « maskable »). */
function draw(size, contentScale) {
  const margin = (1 - contentScale) / 2;
  const samples = [0.25, 0.75];
  return encodePng(size, (x, y) => {
    // Sur-échantillonnage 2×2 pour des bords lisses.
    const sum = [0, 0, 0];
    for (const sx of samples) {
      for (const sy of samples) {
        const u = ((x + sx) / size - margin) / contentScale;
        const v = ((y + sy) / size - margin) / contentScale;
        const color = u < 0 || u > 1 || v < 0 || v > 1 ? BG : scene(u, v);
        for (let i = 0; i < 3; i++) sum[i] += color[i];
      }
    }
    return sum.map((c) => Math.round(c / 4));
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = [
  ['apple-touch-icon.png', 180, 0.86],
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  ['icon-maskable-512.png', 512, 0.68],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, OUT_DIR), draw(size, scale));
  console.log(`public/icons/${name}`);
}
