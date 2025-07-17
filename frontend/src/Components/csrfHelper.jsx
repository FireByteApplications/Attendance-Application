import { useEffect, useState } from 'react';

export function useCsrfToken(apiurl) {
  const [token, setToken] = useState('');
  
  useEffect(() => {
    fetch(`${apiurl}/csrf-token`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setToken(data.csrfToken))
      .catch(console.error);
  }, [apiurl]);

  return token;
}
