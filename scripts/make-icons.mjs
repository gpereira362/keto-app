// Genera los íconos PNG de la PWA sin dependencias (zlib de Node). Uso: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [4, 120, 87];      // emerald-700
const PLATE = [255, 255, 255];
const FOOD = [167, 243, 208]; // emerald-200

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Plato blanco (anillo) con un círculo verde claro al centro, sobre fondo verde a sangre (apto maskable). */
function draw(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // 4×4 submuestras para bordes suaves
      let acc = [0, 0, 0];
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const d = Math.hypot(x + (sx + 0.5) / 4 - c, y + (sy + 0.5) / 4 - c) / size;
        const col = d < 0.13 ? FOOD : d < 0.2 ? BG : d < 0.27 ? PLATE : BG;
        acc = acc.map((v, i) => v + col[i]);
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = acc[0] / 16; raw[o + 1] = acc[1] / 16; raw[o + 2] = acc[2] / 16;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['pwa-192.png', 192], ['pwa-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), draw(size));
}
writeFileSync(new URL('../public/favicon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#047857"/>
  <circle cx="50" cy="50" r="23.5" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="50" cy="50" r="13" fill="#a7f3d0"/>
</svg>
`);
console.log('Íconos generados en public/');
