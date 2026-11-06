import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
const entry = manifest['index.html'];
if (!entry?.file) throw new Error('Missing frontend entry in Vite manifest');

const urls = [
  '/offline.html',
  '/assets/site.webmanifest',
  '/assets/android-chrome-192x192.png',
  '/assets/android-chrome-512x512.png',
  '/assets/maskable-192.png',
  '/assets/maskable-512.png',
  '/assets/apple-touch-icon.png',
  `/${entry.file}`,
  ...(entry.css || []).map((file) => `/${file}`),
];
const source = readFileSync(resolve('public/sw.js'), 'utf8');
const assetMarker = "['/offline.html', '/assets/site.webmanifest']";
if (!source.includes(assetMarker) || !source.includes('__PWA_VERSION__')) {
  throw new Error('Service worker template markers are missing');
}

const hash = createHash('sha256').update(source).update(readFileSync(resolve(dist, 'index.html')));
for (const url of urls) {
  const bytes = readFileSync(resolve(dist, url.slice(1)));
  hash.update(url).update(bytes);
}
const version = hash.digest('hex').slice(0, 16);
const worker = source
  .replace(assetMarker, JSON.stringify(urls))
  .replace('__PWA_VERSION__', version);
writeFileSync(resolve(dist, 'sw.js'), worker);
console.log(`Service worker ${version}: ${urls.length} public assets; API and auth requests remain network-only`);
