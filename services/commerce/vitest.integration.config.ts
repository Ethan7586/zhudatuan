import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/repository/**/*.test.ts', 'tests/job/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
