import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');

test('manifest icons resolve to real files with matching PNG dimensions', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'public/assets/site.webmanifest'), 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');

  const maskableSizes = [];
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('/assets/'));
    const path = resolve(root, 'public', icon.src.slice(1));
    assert.ok(existsSync(path), `${icon.src} must exist`);
    const png = readFileSync(path);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
    if (icon.purpose === 'maskable') {
      assert.equal(png[25], 2, `${icon.src} needs an opaque RGB background`);
      maskableSizes.push(icon.sizes);
    }
  }
  assert.deepEqual(maskableSizes, ['192x192', '512x512']);
});

function workerHarness() {
  const handlers = {};
  const calls = { fetch: [], cached: [], skipped: 0 };
  const offline = { source: 'offline-page' };
  const cache = {
    addAll: async (urls) => { calls.cached = urls; },
    match: async (request) => request.url?.endsWith('/offline.html') ? offline : undefined,
    put: async () => {},
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async (path) => path === '/offline.html' ? offline : undefined,
  };
  const self = {
    location: { origin: 'https://attendance.example' },
    registration: { active: {} },
    clients: { claim: async () => {} },
    skipWaiting: async () => { calls.skipped++; },
    addEventListener: (type, handler) => { handlers[type] = handler; },
  };
  vm.runInNewContext(readFileSync(resolve(root, 'public/sw.js'), 'utf8'), {
    self, caches, URL,
    fetch: async (request) => {
      calls.fetch.push(request.url);
      throw new Error('offline');
    },
    Response: { error: () => ({ source: 'network-error' }) },
  });
  return { handlers, calls, offline };
}

test('service worker leaves API, authentication, and cross-origin requests untouched', () => {
  const { handlers } = workerHarness();
  for (const path of ['/api/attendance/submit', '/auth/login', '/csrf-token', 'https://api.example/data']) {
    let intercepted = false;
    const url = path.startsWith('https:') ? path : `https://attendance.example${path}`;
    handlers.fetch({ request: { method: 'GET', mode: 'navigate', url }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, `${path} must stay on the network`);
  }
});

test('offline navigation shows fallback without caching pages, and updates wait for consent', async () => {
  const { handlers, calls, offline } = workerHarness();
  let installation;
  handlers.install({ waitUntil: (work) => { installation = work; } });
  await installation;
  assert.ok(calls.cached.includes('/offline.html'));
  assert.ok(calls.cached.every((path) => !/^\/(api|auth|csrf-token)/.test(path)));
  assert.equal(calls.skipped, 0);

  let navigation;
  handlers.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://attendance.example/attendance' },
    respondWith: (work) => { navigation = work; },
  });
  assert.equal(await navigation, offline);
  assert.deepEqual(calls.fetch, ['https://attendance.example/attendance']);

  handlers.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(calls.skipped, 1);
});
