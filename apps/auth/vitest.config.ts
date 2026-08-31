import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
