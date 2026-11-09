const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const csrfErrorCodes = new Set([
  'CSRF_HEADER_MISSING',
  'CSRF_SESSION_TOKEN_MISSING',
  'CSRF_TOKEN_INVALID',
]);

export function createCsrfClient(request = (...args) => fetch(...args)) {
  const tokens = new Map();
  const pending = new Map();

  function clear(apiurl) {
    if (apiurl === undefined) {
      tokens.clear();
      pending.clear();
      return;
    }
    tokens.delete(apiurl);
    pending.delete(apiurl);
  }

  async function getToken(apiurl) {
    if (tokens.has(apiurl)) return tokens.get(apiurl);
    if (pending.has(apiurl)) return pending.get(apiurl);

    const tokenRequest = (async () => {
      const response = await request(`${apiurl}/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`CSRF request failed: ${response.status}`);
      const data = await response.json();
      if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
        throw new Error('CSRF token missing from response');
      }
      if (pending.get(apiurl) === tokenRequest) tokens.set(apiurl, data.csrfToken);
      return data.csrfToken;
    })();

    pending.set(apiurl, tokenRequest);
    try {
      return await tokenRequest;
    } finally {
      if (pending.get(apiurl) === tokenRequest) pending.delete(apiurl);
    }
  }

  async function csrfFetch(apiurl, path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const unsafe = unsafeMethods.has(method);
    const makeRequest = (token) => {
      const headers = new Headers(options.headers || {});
      if (unsafe) headers.set('X-CSRF-Token', token);
      return request(`${apiurl}${path}`, {
        ...options,
        method,
        credentials: 'include',
        headers,
      });
    };

    if (!unsafe) return makeRequest();

    const token = await getToken(apiurl);
    let response = await makeRequest(token);
    if (response.status !== 403) return response;

    let errorData;
    try {
      errorData = await response.clone().json();
    } catch {
      return response;
    }
    if (!csrfErrorCodes.has(errorData?.code)) return response;

    if (tokens.get(apiurl) === token) clear(apiurl);
    response = await makeRequest(await getToken(apiurl));
    return response;
  }

  return { getToken, csrfFetch, clear };
}

export const csrfClient = createCsrfClient();
