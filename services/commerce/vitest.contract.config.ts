import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/architecture/**/*.test.ts', 'tests/http/**/*.test.ts', 'tests/event/**/*.test.ts', 'tests/handler/**/*.test.ts'],
    environment: 'node',
  },
});
