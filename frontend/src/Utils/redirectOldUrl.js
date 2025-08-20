const isProd = import.meta.env.VITE_STAGE === 'prod';
const expected = 'jrfbattendanceappfd-d7bmgfb8f6g6debw.z03.azurefd.net'
const current = window.location.hostname;

if (
  isProd &&
  expected &&
  current.endsWith('.azurestaticapps.net') &&
  current !== expected
) {
  const { pathname, search, hash } = window.location;
  window.location.href = `https://${expected}${pathname}${search}${hash}`;
}
