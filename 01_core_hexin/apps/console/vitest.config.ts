import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify('0.0.0-test'),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/RuntimeConfigSetup.ts'],
  },
});
