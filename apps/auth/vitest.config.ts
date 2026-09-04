import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    execArgv: ['--no-experimental-webstorage'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['test/Setup.ts'],
  },
});
