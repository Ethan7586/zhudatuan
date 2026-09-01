import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:3001'),
    'import.meta.env.VITE_AUTH_BASE_URL': JSON.stringify('http://127.0.0.1:3002'),
    'import.meta.env.VITE_STOREFRONT_ORIGIN': JSON.stringify('http://127.0.0.1:3000'),
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify('0.0.0-test'),
  },
  test: {
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});
