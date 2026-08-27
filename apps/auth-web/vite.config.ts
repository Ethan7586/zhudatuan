import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
<<<<<<< HEAD
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { validateAuthBuildEnvironment } from './src/buildEnvironment';

const authRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  if (command === 'build') validateAuthBuildEnvironment({ ...loadEnv(mode, authRoot, ''), ...process.env });
  return {
    envDir: authRoot,
    // Relative assets let the exact same reviewed dist run at
    // accounts.zhudatuan.com/ and at the storefront's optional /login/ mount.
    base: command === 'build' ? './' : '/',
=======
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // 生产环境由消费者站点同域 /login 提供，确保 HttpOnly 会话保持同源。
    base: command === 'build' ? '/login/' : '/',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3002,
      // Keep the development server stable when a CI-like environment disables HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Keep the explicit host allowlist; do not turn on allowHosts: true.
    preview: {
      allowedHosts: ['zhudatuan.com', 'www.zhudatuan.com', 'console.zhudatuan.com', 'hbbtzn.com', 'www.hbbtzn.com', 'smart.hbbtzn.com'],
    },
  };
});
