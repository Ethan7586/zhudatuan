import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import { networkHtml } from '@shop/config/networkhtml';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // Relative assets keep the reviewed Auth artifact independent of its mount path.
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss(), { name: 'network-html', transformIndexHtml: networkHtml }],
    build: { manifest: true },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 3002,
      // Keep the development server stable when a CI-like environment disables HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Keep the explicit host allowlist; do not turn on allowHosts: true.
    preview: {
      allowedHosts: Object.values(NETWORK_CATALOG.origins).map((origin) => new URL(origin).hostname),
    },
  };
});
