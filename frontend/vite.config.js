import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:3443';
const localHttps = process.env.NODE_ENV === 'development' && process.env.LOCAL_HTTPS === '1';

const localHttpsOptions = localHttps
  ? {
      key: readFileSync(process.env.LOCAL_HTTPS_KEY || '.local-certs/dev.key'),
      cert: readFileSync(process.env.LOCAL_HTTPS_CERT || '.local-certs/dev.crt'),
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { manifest: true },
  server: {
    host: '0.0.0.0',
    ...(localHttps
      ? {
          https: localHttpsOptions,
          hmr: { clientPort: Number(process.env.LOCAL_HTTPS_CLIENT_PORT || 5173) },
        }
      : {}),
    proxy: {
      '/api': apiProxyTarget,
      '/auth': apiProxyTarget,
      '/csrf-token': apiProxyTarget,
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});

