import { useEffect, useState } from 'react';
import { csrfClient } from '../Utils/csrfClient.js';

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => csrfClient.clear());
}

export function useCsrfToken(apiurl) {
  const [token, setToken] = useState('');

  useEffect(() => {
    let active = true;
    csrfClient.getToken(apiurl)
      .then((value) => { if (active) setToken(value); })
      .catch((error) => {
        console.error('Failed to fetch CSRF token:', error);
        if (active) setToken('');
      });
    return () => { active = false; };
  }, [apiurl]);

  return token;
}

export const csrfFetch = csrfClient.csrfFetch;
export const clearCsrfTokenCache = csrfClient.clear;
