// Generates placeholder branding assets (PNG/ICNS/ICO) for StudyBud.
//
// This is a one-off developer tool; real artwork can replace the outputs in
// resources/branding/ without any code changes. The script draws a 1024x1024
// square with a solid dark navy background and a large rounded-rect tile
// with the letters "SB" rendered as a monochrome bitmap. No native graphics
// dependencies are required.
//
// Usage: node scripts/generate-placeholder-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const brandingDir = path.join(repoRoot, 'resources', 'branding');
fs.mkdirSync(brandingDir, { recursive: true });

const SIZE = 1024;
const BG = [13, 19, 32]; // #0d1320 - app background
const FG = [196, 181, 253]; // #c4b5fd - soft primary

// 7x5 monochrome bitmap font for a few glyphs
const FONT = {
  S: [
    '.XXXX.',
    'X....X',
    'X.....',
    '.XXXX.',
    '.....X',
    'X....X',
    '.XXXX.',
  ],
  B: [
    'XXXXX.',
    'X....X',
    'X....X',
    'XXXXX.',
    'X....X',
    'X....X',
    'XXXXX.',
  ],
};

const makePixels = () => {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    pixels[i * 4] = BG[0];
    pixels[i * 4 + 1] = BG[1];
    pixels[i * 4 + 2] = BG[2];
    pixels[i * 4 + 3] = 255;
  }

  // Rounded-rect tile (simulate with a large block) for the glyph backdrop.
  const tileInset = 96;
  const radius = 160;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inX = x >= tileInset && x < SIZE - tileInset;
      const inY = y >= tileInset && y < SIZE - tileInset;
      if (!inX || !inY) continue;
      // Trim corners for a rounded look.
      const cornerX = Math.max(
        tileInset + radius - x,
        x - (SIZE - tileInset - radius),
        0,
      );
      const cornerY = Math.max(
        tileInset + radius - y,
        y - (SIZE - tileInset - radius),
        0,
      );
      if (cornerX > 0 && cornerY > 0) {
        const d2 = cornerX * cornerX + cornerY * cornerY;
        if (d2 > radius * radius) continue;
      }
      const idx = (y * SIZE + x) * 4;
      pixels[idx] = 24;
      pixels[idx + 1] = 32;
      pixels[idx + 2] = 58;
      pixels[idx + 3] = 255;
    }
  }

  // Draw "SB" using the simple font. Each glyph is 6 cols x 7 rows.
  const glyphs = ['S', 'B'];
  const cellW = 6;
  const cellH = 7;
  const scale = 72; // each font pixel becomes 72x72
  const glyphW = cellW * scale;
  const glyphH = cellH * scale;
  const spacing = 40;
  const totalW = glyphW * glyphs.length + spacing * (glyphs.length - 1);
  const startX = Math.floor((SIZE - totalW) / 2);
  const startY = Math.floor((SIZE - glyphH) / 2);
  for (let g = 0; g < glyphs.length; g++) {
    const rows = FONT[glyphs[g]];
    const baseX = startX + g * (glyphW + spacing);
    for (let ry = 0; ry < cellH; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < cellW; rx++) {
        if (row[rx] !== 'X') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = baseX + rx * scale + dx;
            const py = startY + ry * scale + dy;
            if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;
            const idx = (py * SIZE + px) * 4;
            pixels[idx] = FG[0];
            pixels[idx + 1] = FG[1];
            pixels[idx + 2] = FG[2];
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  }

  return pixels;
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const writeChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const encodePng = (size, pixels) => {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Add per-row filter byte (0 = None).
  const rowStride = size * 4;
  const raw = Buffer.alloc(size * (rowStride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (rowStride + 1)] = 0;
    pixels.copy(raw, y * (rowStride + 1) + 1, y * rowStride, (y + 1) * rowStride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    header,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idat),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
};

const bilinearDownscale = (srcPixels, srcSize, dstSize) => {
  if (srcSize === dstSize) return srcPixels;
  const out = Buffer.alloc(dstSize * dstSize * 4);
  const ratio = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    const sy = Math.min(Math.floor(y * ratio), srcSize - 1);
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.min(Math.floor(x * ratio), srcSize - 1);
      const srcIdx = (sy * srcSize + sx) * 4;
      const dstIdx = (y * dstSize + x) * 4;
      out[dstIdx] = srcPixels[srcIdx];
      out[dstIdx + 1] = srcPixels[srcIdx + 1];
      out[dstIdx + 2] = srcPixels[srcIdx + 2];
      out[dstIdx + 3] = srcPixels[srcIdx + 3];
    }
  }
  return out;
};

const encodeIcns = (pngBySize) => {
  // ICNS OSType table: maps square size -> 4-char code for retina PNG entry.
  const entries = [
    { size: 16, type: 'icp4' },
    { size: 32, type: 'icp5' },
    { size: 64, type: 'icp6' },
    { size: 128, type: 'ic07' },
    { size: 256, type: 'ic08' },
    { size: 512, type: 'ic09' },
    { size: 1024, type: 'ic10' },
  ];
  const chunks = [];
  for (const { size, type } of entries) {
    const png = pngBySize[size];
    if (!png) continue;
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(png.length + 8, 4);
    chunks.push(Buffer.concat([header, png]));
  }
  const body = Buffer.concat(chunks);
  const outer = Buffer.alloc(8);
  outer.write('icns', 0, 4, 'ascii');
  outer.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([outer, body]);
};

const encodeIco = (pngBySize) => {
  const sizes = [16, 32, 48, 64, 128, 256].filter((s) => pngBySize[s]);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(sizes.length, 4);

  const dirEntries = [];
  const imageBlobs = [];
  let offset = 6 + 16 * sizes.length;
  for (const size of sizes) {
    const png = pngBySize[size];
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageBlobs.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBlobs]);
};

const main = () => {
  const pixels1024 = makePixels();

  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngBySize = {};
  for (const size of sizes) {
    const scaled = bilinearDownscale(pixels1024, SIZE, size);
    pngBySize[size] = encodePng(size, scaled);
  }

  fs.writeFileSync(path.join(brandingDir, 'icon.png'), pngBySize[1024]);
  fs.writeFileSync(path.join(brandingDir, 'icon.icns'), encodeIcns(pngBySize));
  fs.writeFileSync(path.join(brandingDir, 'icon.ico'), encodeIco(pngBySize));

  console.log(`Wrote placeholder icons under ${brandingDir}`);
  for (const name of ['icon.png', 'icon.icns', 'icon.ico']) {
    const p = path.join(brandingDir, name);
    const stat = fs.statSync(p);
    console.log(`  ${name}: ${stat.size} bytes`);
  }
};

main();
