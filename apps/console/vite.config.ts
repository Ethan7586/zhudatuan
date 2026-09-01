import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { networkHtml } from '@shop/config/networkhtml';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), { name: 'network-html', transformIndexHtml: networkHtml }],
    build: { manifest: true },
    server: {
      host: '127.0.0.1',
      port: 4173,
      /** Development mirrors the canonical Console-to-Commerce request path. */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
      // Automated environments may disable HMR and watching to reduce background work.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
