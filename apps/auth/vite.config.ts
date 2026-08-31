import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // Relative assets let the exact same reviewed dist run at
    // accounts.zhudatuan.com/ and at the storefront's optional /login/ mount.
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss()],
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
      allowedHosts: ['zhudatuan.com', 'www.zhudatuan.com', 'accounts.zhudatuan.com', 'console.zhudatuan.com'],
    },
  };
});
