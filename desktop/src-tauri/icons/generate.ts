/**
 * Generates all required Tauri icon files from icon.svg.
 *
 * Outputs:
 *   32x32.png        — Linux / Windows toolbar
 *   128x128.png      — Linux app icon
 *   128x128@2x.png   — Linux HiDPI (256×256)
 *   icon.ico         — Windows (32×32 PNG wrapped in ICO container)
 *   icon.icns        — macOS (ICNS container with 32, 64, 128, 256, 512px)
 *
 * Run with:
 *   bun desktop/src-tauri/icons/generate.ts
 *   (or: bun run icons:generate from the repo root)
 *
 * Requires @resvg/resvg-js (listed in root package.json dependencies).
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgData = readFileSync(join(__dirname, 'icon.svg'), 'utf-8');

// ---------------------------------------------------------------------------
// Helper: render SVG to PNG buffer at a given size
// ---------------------------------------------------------------------------
function renderPng(size: number): Uint8Array {
  return new Resvg(svgData, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
}

// ---------------------------------------------------------------------------
// PNGs
// ---------------------------------------------------------------------------
const pngSizes: { filename: string; size: number }[] = [
  { filename: '32x32.png',      size: 32  },
  { filename: '128x128.png',    size: 128 },
  { filename: '128x128@2x.png', size: 256 },
];

for (const { filename, size } of pngSizes) {
  writeFileSync(join(__dirname, filename), renderPng(size));
  console.log(`  ✓ ${filename} (${size}×${size})`);
}

// ---------------------------------------------------------------------------
// .ico (Windows) — 32×32 PNG embedded in ICO container
// ---------------------------------------------------------------------------
function buildIco(png: Uint8Array): Buffer {
  const size = png.length;
  const buf = Buffer.alloc(6 + 16 + size);
  // ICONDIR
  buf.writeUInt16LE(0, 0);  // reserved
  buf.writeUInt16LE(1, 2);  // type: 1 = ICO
  buf.writeUInt16LE(1, 4);  // image count
  // ICONDIRENTRY
  buf.writeUInt8(32, 6);    // width
  buf.writeUInt8(32, 7);    // height
  buf.writeUInt8(0,  8);    // color count
  buf.writeUInt8(0,  9);    // reserved
  buf.writeUInt16LE(1,  10); // color planes
  buf.writeUInt16LE(32, 12); // bits per pixel
  buf.writeUInt32LE(size, 14); // image data size
  buf.writeUInt32LE(22,   18); // image data offset (6 + 16)
  Buffer.from(png).copy(buf, 22);
  return buf;
}

writeFileSync(join(__dirname, 'icon.ico'), buildIco(renderPng(32)));
console.log('  ✓ icon.ico (32×32)');

// ---------------------------------------------------------------------------
// .icns (macOS) — ICNS container with multiple PNG sizes
//
// ICNS format: 4-byte magic + 4-byte total-length, then a series of chunks:
//   4-byte OSType tag + 4-byte chunk-length (includes the 8-byte header) + data
//
// Tags used here (all accept PNG data in modern macOS):
//   icp4  → 16×16
//   icp5  → 32×32
//   icp6  → 64×64
//   ic07  → 128×128
//   ic08  → 256×256
//   ic09  → 512×512
// ---------------------------------------------------------------------------
function buildIcns(entries: { tag: string; png: Uint8Array }[]): Buffer {
  const chunks = entries.map(({ tag, png }) => {
    const chunkLen = 8 + png.length;
    const chunk = Buffer.alloc(chunkLen);
    chunk.write(tag, 0, 'ascii');
    chunk.writeUInt32BE(chunkLen, 4);
    Buffer.from(png).copy(chunk, 8);
    return chunk;
  });

  const totalLen = 8 + chunks.reduce((s, c) => s + c.length, 0);
  const out = Buffer.alloc(totalLen);
  out.write('icns', 0, 'ascii');
  out.writeUInt32BE(totalLen, 4);

  let offset = 8;
  for (const chunk of chunks) {
    chunk.copy(out, offset);
    offset += chunk.length;
  }
  return out;
}

const icnsEntries = [
  { tag: 'icp4', png: renderPng(16)  },
  { tag: 'icp5', png: renderPng(32)  },
  { tag: 'icp6', png: renderPng(64)  },
  { tag: 'ic07', png: renderPng(128) },
  { tag: 'ic08', png: renderPng(256) },
  { tag: 'ic09', png: renderPng(512) },
];

writeFileSync(join(__dirname, 'icon.icns'), buildIcns(icnsEntries));
console.log('  ✓ icon.icns (16, 32, 64, 128, 256, 512)');

console.log('\nAll icons generated.');
