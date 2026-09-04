import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts', 'miniprogram/feature/**/*.test.ts'] },
});
