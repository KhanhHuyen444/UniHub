import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const frontendDirectory = fileURLToPath(new URL('.', import.meta.url));
const browserTargets = ['chrome110', 'edge110', 'firefox110', 'safari16'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendDirectory, 'API_PROXY_TARGET');
  const proxyTarget =
    process.env.API_PROXY_TARGET ??
    env.API_PROXY_TARGET ??
    'http://127.0.0.1:3001';

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    build: { target: browserTargets, cssTarget: browserTargets },
  };
});
