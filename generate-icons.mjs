// Export the selected heart artwork at browser and PWA sizes.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const source = fileURLToPath(new URL('../assets/carelink-heart-master.png', import.meta.url));
const directory = new URL('../public/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, size] of [['icon-192.png',192], ['icon-512.png',512], ['favicon-32.png',32], ['apple-touch-icon.png',180]]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(name, directory)));
}
// Padding keeps the heart inside the maskable icon's central safe area.
await sharp(source).resize(410, 410)
  .extend({ top:51, bottom:51, left:51, right:51, background:'#fff3f3' })
  .png().toFile(fileURLToPath(new URL('icon-maskable-512.png', directory)));
console.log('Created CareLink heart icons.');
