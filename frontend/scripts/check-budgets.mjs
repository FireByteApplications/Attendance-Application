import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
const kib = 1024;
const budgets = {
  initialJs: 90 * kib,
  initialCss: 40 * kib,
  initialTotal: 130 * kib,
  standardRoute: 145 * kib,
  reportRoute: 190 * kib,
};
const errors = [];

function assetsFor(key, seen = new Set()) {
  if (seen.has(key)) return new Set();
  const entry = manifest[key];
  if (!entry) throw new Error(`Missing Vite manifest entry: ${key}`);
  seen.add(key);
  const assets = new Set([entry.file, ...(entry.css || [])].filter(Boolean));
  for (const dependency of entry.imports || []) {
    for (const asset of assetsFor(dependency, seen)) assets.add(asset);
  }
  return assets;
}

function gzipBytes(assets, extension) {
  return [...assets]
    .filter((asset) => asset.endsWith(extension))
    .reduce((total, asset) => total + gzipSync(readFileSync(resolve(dist, asset))).length, 0);
}

function check(label, bytes, budget) {
  const actual = (bytes / kib).toFixed(1);
  const allowed = (budget / kib).toFixed(0);
  console.log(`${label}: ${actual} KiB gzip (budget ${allowed} KiB)`);
  if (bytes > budget) errors.push(`${label} exceeds its budget by ${((bytes - budget) / kib).toFixed(1)} KiB`);
}

const initial = assetsFor('index.html');
const initialJs = gzipBytes(initial, '.js');
const initialCss = gzipBytes(initial, '.css');
check('Initial JavaScript', initialJs, budgets.initialJs);
check('Initial CSS', initialCss, budgets.initialCss);
check('Initial JS + CSS', initialJs + initialCss, budgets.initialTotal);

for (const [key, entry] of Object.entries(manifest)) {
  if (!entry.isDynamicEntry) continue;
  const assets = assetsFor(key);
  const total = gzipBytes(assets, '.js') + gzipBytes(assets, '.css');
  const budget = key.includes('/reports.jsx') || key.includes('/rolereports.jsx')
    ? budgets.reportRoute
    : budgets.standardRoute;
  check(key, total, budget);
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}
