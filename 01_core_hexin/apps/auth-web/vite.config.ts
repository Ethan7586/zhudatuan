import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { validateAuthBuildEnvironment } from './src/buildEnvironment';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    validateAuthBuildEnvironment(loadEnv(mode, __dirname, ''));
  }

  return {
    // Relative assets let the exact same reviewed dist run at
    // accounts.zhudatuan.com/ and at the storefront's optional /login/ mount.
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3002,
      proxy: {
        '/api': {
          // Auth endpoints live on the storefront compatibility BFF, not the
          // canonical Commerce API (:3001).
          target: process.env.AUTH_COMPAT_API_ORIGIN ?? 'http://127.0.0.1:3000',
          changeOrigin: false,
        },
      },
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
