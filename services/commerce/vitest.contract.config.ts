import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/http/**/*.test.ts', 'tests/event/**/*.test.ts'],
    environment: 'node',
  },
});
