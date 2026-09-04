import { defineConfig } from 'vitest/config';

/** Keep API tests isolated from any parent-directory Vite configuration. */
export default defineConfig({
  test: {
    include: ['src/api/**/*.test.ts'],
    environment: 'node',
  },
});
