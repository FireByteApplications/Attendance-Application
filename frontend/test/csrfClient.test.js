import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsrfClient } from '../src/Utils/csrfClient.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone() { return response(status, body); },
  };
}

test('concurrent writes share one token request and reuse the token', async () => {
  const calls = [];
  const client = createCsrfClient(async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/csrf-token')
      ? response(200, { csrfToken: 'session-token' })
      : response(200, { ok: true });
  });

  await Promise.all([
    client.csrfFetch('', '/one', { method: 'POST' }),
    client.csrfFetch('', '/two', { method: 'PATCH' }),
  ]);
  await client.csrfFetch('', '/three', { method: 'DELETE' });

  assert.equal(calls.filter(({ url }) => url === '/csrf-token').length, 1);
  assert.deepEqual(
    calls.filter(({ url }) => url !== '/csrf-token').map(({ options }) => options.headers.get('X-CSRF-Token')),
    ['session-token', 'session-token', 'session-token'],
  );
});

test('recognized CSRF rejection refreshes the token and retries once', async () => {
  let tokenRequests = 0;
  let writes = 0;
  const client = createCsrfClient(async (url, options) => {
    if (url.endsWith('/csrf-token')) return response(200, { csrfToken: `token-${++tokenRequests}` });
    writes++;
    assert.equal(options.headers.get('X-CSRF-Token'), `token-${writes}`);
    return writes === 1
      ? response(403, { code: 'CSRF_TOKEN_INVALID' })
      : response(200, { ok: true });
  });

  assert.equal((await client.csrfFetch('', '/write', { method: 'POST' })).status, 200);
  assert.equal(tokenRequests, 2);
  assert.equal(writes, 2);
});

test('simultaneous stale-token responses share one refresh', async () => {
  let tokenRequests = 0;
  const client = createCsrfClient(async (url, options) => {
    if (url.endsWith('/csrf-token')) return response(200, { csrfToken: `token-${++tokenRequests}` });
    return options.headers.get('X-CSRF-Token') === 'token-1'
      ? response(403, { code: 'CSRF_TOKEN_INVALID' })
      : response(200, { ok: true });
  });

  const results = await Promise.all([
    client.csrfFetch('', '/one', { method: 'POST' }),
    client.csrfFetch('', '/two', { method: 'POST' }),
  ]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(tokenRequests, 2);
});

test('unrelated authorization failure does not refresh or retry', async () => {
  let tokenRequests = 0;
  let writes = 0;
  const client = createCsrfClient(async (url) => {
    if (url.endsWith('/csrf-token')) {
      tokenRequests++;
      return response(200, { csrfToken: 'token' });
    }
    writes++;
    return response(403, { code: 'ADMIN_REQUIRED' });
  });

  assert.equal((await client.csrfFetch('', '/write', { method: 'POST' })).status, 403);
  assert.equal(tokenRequests, 1);
  assert.equal(writes, 1);
});

test('clearing the cache obtains a new token for the next write', async () => {
  let tokenRequests = 0;
  const client = createCsrfClient(async (url) => url.endsWith('/csrf-token')
    ? response(200, { csrfToken: `token-${++tokenRequests}` })
    : response(200, {}));

  await client.csrfFetch('', '/write', { method: 'POST' });
  client.clear();
  await client.csrfFetch('', '/write', { method: 'POST' });
  assert.equal(tokenRequests, 2);
});
