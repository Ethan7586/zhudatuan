import react from '@vitejs/plugin-react';
import { networkHtml } from '@shop/config/networkhtml';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), { name: 'network-html', transformIndexHtml: networkHtml }],
  server: {
    host: '127.0.0.1',
    port: 3000,
    fs: {
      allow: ['..', '../..', '../../..'],
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    manifest: true,
  },
});
