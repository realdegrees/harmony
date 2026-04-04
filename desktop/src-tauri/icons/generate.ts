/**
 * Generates all required Tauri icon PNGs from icon.svg.
 * Run with: bun desktop/src-tauri/icons/generate.ts
 *
 * Requires @resvg/resvg-js (already in Bun's module cache).
 * Install if missing: bun add -g @resvg/resvg-js
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'icon.svg');
const svgData = readFileSync(svgPath, 'utf-8');

const sizes: { filename: string; size: number }[] = [
  { filename: '32x32.png',       size: 32  },
  { filename: '128x128.png',     size: 128 },
  { filename: '128x128@2x.png',  size: 256 },
];

for (const { filename, size } of sizes) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  const outPath = join(__dirname, filename);
  writeFileSync(outPath, png);
  console.log(`  ✓ ${filename} (${size}×${size})`);
}

// Generate a minimal placeholder .ico (32x32 PNG wrapped in ICO container)
// A proper ICO is a container of PNG/BMP images. The simplest valid ICO
// is just a 32x32 PNG embedded in the ICO format header.
function pngToIco(pngBuffer: Uint8Array): Buffer {
  const pngSize = pngBuffer.length;
  // ICO header: 6 bytes
  // Image directory entry: 16 bytes
  // PNG data follows
  const buf = Buffer.alloc(6 + 16 + pngSize);
  let offset = 0;

  // ICONDIR header
  buf.writeUInt16LE(0, offset);       // reserved
  buf.writeUInt16LE(1, offset + 2);   // type: 1 = icon
  buf.writeUInt16LE(1, offset + 4);   // number of images
  offset += 6;

  // ICONDIRENTRY
  buf.writeUInt8(32, offset);         // width (0 = 256)
  buf.writeUInt8(32, offset + 1);     // height
  buf.writeUInt8(0,  offset + 2);     // color count (0 = no palette)
  buf.writeUInt8(0,  offset + 3);     // reserved
  buf.writeUInt16LE(1, offset + 4);   // color planes
  buf.writeUInt16LE(32, offset + 6);  // bits per pixel
  buf.writeUInt32LE(pngSize, offset + 8);  // size of image data
  buf.writeUInt32LE(6 + 16, offset + 12); // offset to image data
  offset += 16;

  // PNG data
  Buffer.from(pngBuffer).copy(buf, offset);

  return buf;
}

// Generate .ico from 32x32 PNG
const resvg32 = new Resvg(svgData, { fitTo: { mode: 'width', value: 32 } });
const png32 = resvg32.render().asPng();
const icoBuffer = pngToIco(png32);
writeFileSync(join(__dirname, 'icon.ico'), icoBuffer);
console.log('  ✓ icon.ico (32×32 embedded PNG)');

console.log('\nAll icons generated.');
