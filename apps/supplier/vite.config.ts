import react from '@vitejs/plugin-react';
import { networkHtml } from '@shop/config/networkhtml';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), { name: 'network-html', transformIndexHtml: networkHtml }],
  build: { manifest: true },
  server: {
    host: '127.0.0.1',
    port: 4176,
    proxy: { '/api': { target: process.env.COMMERCE_API_ORIGIN ?? 'http://127.0.0.1:3001', changeOrigin: false } },
  },
});
