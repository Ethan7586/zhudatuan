import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    execArgv: ['--no-experimental-webstorage'],
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    clearMocks: true,
  },
});
