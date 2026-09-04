import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:3001'),
    'import.meta.env.VITE_AUTH_BASE_URL': JSON.stringify('http://127.0.0.1:5176'),
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify('0.0.0-test'),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});
