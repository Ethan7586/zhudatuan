import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // 生产环境由消费者站点同域 /login 提供，确保 HttpOnly 会话保持同源。
    base: command === 'build' ? '/login/' : '/',
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
